import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import aiService from './ai.service';

let queue: Queue | null = null;
let scheduler: any = null;
let worker: Worker | null = null;

export async function initQueue() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  // BullMQ requires ioredis option `maxRetriesPerRequest` to be null.
  // Ensure we create the client with that option to avoid "Your redis options maxRetriesPerRequest must be null" errors.
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
  // attach early error handlers to avoid unhandled 'error' events from ioredis
  connection.on('error', (err: any) => {
    console.warn('Redis connection error (ioredis):', err && (err.message || err));
  });
  connection.on('close', () => {
    console.warn('Redis connection closed');
  });
  connection.on('connect', () => {
    console.log('Redis connected');
  });
  const queueName = process.env.LLM_QUEUE_NAME || 'llm-requests';
  // verify redis connection early to give a clear error if Redis is not running
  try {
    await connection.ping();
  } catch (e) {
    try {
      // stop reconnect attempts and free resources
      if (typeof connection.disconnect === 'function') connection.disconnect();
      if (typeof connection.quit === 'function') connection.quit();
    } catch (cleanupErr) {
      // ignore cleanup errors
    }
    throw new Error(`Unable to connect to Redis at ${redisUrl}: ${e?.message || e}`);
  }

  queue = new Queue(queueName, { connection } as any);
  // Try to create a QueueScheduler but tolerate API differences across bullmq versions
  try {
    // Use dynamic require to avoid TypeScript signature issues across bullmq major versions
    // (some versions export QueueScheduler differently)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const BullMQ = require('bullmq') as any;
    const QueueSchedulerCtor = BullMQ?.QueueScheduler || BullMQ?.QueueScheduler?.default;
    if (QueueSchedulerCtor) {
      scheduler = new QueueSchedulerCtor(queueName, { connection } as any);
      if (typeof (scheduler as any).waitUntilReady === 'function') {
        await (scheduler as any).waitUntilReady();
      } else if (typeof (scheduler as any).connect === 'function') {
        await (scheduler as any).connect();
      }
    } else {
      // no scheduler available in this bullmq build
      scheduler = null;
    }
  } catch (e) {
    // If QueueScheduler isn't available or has a different shape, continue without it
    console.warn('QueueScheduler unavailable or failed to initialize (continuing without scheduler):', e?.message || e);
    scheduler = null;
  }

  // Worker with custom backoff strategy
  worker = new Worker(
    queueName,
    async (job: any) => {
      // job.data: { analysisId, extraContext }
      const analysisId = job.data.analysisId;
      const extra = job.data.extraContext || {};
      // Call the AI service to enrich the analysis; it persists to DB
      // Support optional job-level timeout by respecting job.opts.timeout set when creating the job
      const res = await aiService.enrichAnalysis(analysisId, extra);
      return res;
    },
    {
      connection: connection as any,
      // custom backoff strategy registered below, jobs must set backoff.type='customDelays'
      backoffStrategies: {
        customDelays: (attemptsMade: number, err: Error, opts: any) => {
          try {
            const delays = (opts && opts.delays) || [1000, 5000, 15000];
            const idx = Math.max(0, Math.min(delays.length - 1, attemptsMade - 1));
            return delays[idx];
          } catch (e) {
            return 1000;
          }
        },
      },
    } as any,
  );

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed`);
  });
  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err?.message || err);
  });

  // Setup Bull Board
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');
  // bull-board adapter typings vary between versions; cast to any to avoid strict type mismatch
  const bullAdapter = new (BullMQAdapter as any)(queue as any, { queueScheduler: scheduler } as any);
  createBullBoard({ queues: [bullAdapter as any], serverAdapter } as any);

  return serverAdapter.getRouter();
}

export function getQueue(): Queue | null {
  return queue;
}
