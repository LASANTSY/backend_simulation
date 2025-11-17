import AppDataSource from '../../src/data-source';
import { DataSource } from 'typeorm';
import ProductionPrediction from '../entities/ProductionPrediction';
import TrainedModel from '../entities/TrainedModel';
import DriftAlert from '../entities/DriftAlert';
import logger from '../etl/logger';
import axios from 'axios';
import nodemailer from 'nodemailer';
import cron from 'node-cron';

function ksTest(sample1: number[], sample2: number[]) {
  const xs = sample1.slice().sort((a, b) => a - b);
  const ys = sample2.slice().sort((a, b) => a - b);
  const n1 = xs.length;
  const n2 = ys.length;
  const all = Array.from(new Set(xs.concat(ys))).sort((a, b) => a - b);
  let d = 0;
  let i1 = 0,
    i2 = 0;
  for (const v of all) {
    while (i1 < n1 && xs[i1] <= v) i1++;
    while (i2 < n2 && ys[i2] <= v) i2++;
    const c1 = i1 / n1;
    const c2 = i2 / n2;
    d = Math.max(d, Math.abs(c1 - c2));
  }
  const en = Math.sqrt((n1 * n2) / (n1 + n2));
  const lambda = (en + 0.12 + 0.11 / en) * d;
  let p = 0;
  for (let k = 1; k < 100; k++) {
    const term = Math.pow(-1, k - 1) * Math.exp(-2 * k * k * lambda * lambda);
    p += term;
    if (Math.abs(term) < 1e-8) break;
  }
  p = Math.min(Math.max(2 * p, 0), 1);
  return { D: d, p };
}

function psi(expected: number[], actual: number[], buckets = 10) {
  // compute PSI using equal sized quantile buckets based on expected
  if (expected.length === 0 || actual.length === 0) return 0;
  const sorted = expected.slice().sort((a, b) => a - b);
  const n = sorted.length;
  const breaks: number[] = [];
  for (let i = 0; i <= buckets; i++) {
    const idx = Math.floor((i / buckets) * (n - 1));
    breaks.push(sorted[idx]);
  }
  let psiSum = 0;
  for (let i = 0; i < buckets; i++) {
    const lo = breaks[i];
    const hi = breaks[i + 1];
    const expCount = expected.filter((v) => v >= lo && v <= hi).length / expected.length;
    const actCount = actual.filter((v) => v >= lo && v <= hi).length / actual.length;
    const e = Math.max(expCount, 1e-6);
    const a = Math.max(actCount, 1e-6);
    psiSum += (e - a) * Math.log(e / a);
  }
  return psiSum;
}

export class DriftDetectorService {
  private dataSource: DataSource;
  private pValueThreshold: number;
  private psiThreshold: number;

  constructor(dataSource?: DataSource) {
    this.dataSource = dataSource || (AppDataSource as unknown as DataSource);
    this.pValueThreshold = parseFloat(process.env.DRIFT_PVALUE_THRESHOLD || '0.05');
    this.psiThreshold = parseFloat(process.env.DRIFT_PSI_THRESHOLD || '0.2');

    // schedule daily job at 02:30
    const cronExpr = process.env.DRIFT_CRON || '30 2 * * *';
    cron.schedule(cronExpr, async () => {
      try {
        await this.runDetection();
      } catch (e) {
        logger.error('Drift detection job failed: %s', (e as Error).message);
      }
    });
  }

  async recordPrediction(payload: { model_id?: string; features?: Record<string, any>; prediction?: number; latency_ms?: number; success?: boolean }) {
    await this.ensureInit();
    const repo = this.dataSource.getRepository(ProductionPrediction);
    const rec = repo.create({ model_id: payload.model_id, features: payload.features, prediction: payload.prediction, latency_ms: payload.latency_ms, success: payload.success ?? true });
    await repo.save(rec as any);
  }

  private async ensureInit() {
    if (!(this.dataSource as any).isInitialized) await this.dataSource.initialize();
  }

  async runDetection() {
    await this.ensureInit();
    const repo = this.dataSource.getRepository(ProductionPrediction);
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const recent = await repo.createQueryBuilder('p').where('p.created_at >= :since', { since }).getMany();

    if (recent.length < 10) {
      logger.info('Not enough recent predictions for drift detection (found %d)', recent.length);
      return;
    }

    // group by model
    const byModel: Record<string, any[]> = {};
    for (const r of recent) {
      const mid = r.model_id || 'unknown';
      byModel[mid] = byModel[mid] || [];
      byModel[mid].push(r);
    }

    const modelRepo = this.dataSource.getRepository(TrainedModel);
    const alertRepo = this.dataSource.getRepository(DriftAlert);

    for (const mid of Object.keys(byModel)) {
      try {
        const model = await modelRepo.findOne({ where: { id: mid } });
        const recs = byModel[mid];
        // prediction distribution
        const preds = recs.map((r) => Number(r.prediction || 0));

        // baseline: training sample if present
        const baseline: number[] = (model && model.metrics && (model.metrics.training_sample as number[])) || [];

        if (baseline.length >= 10) {
          const ks = ksTest(baseline, preds);
          const psiVal = psi(baseline, preds);
          logger.info('Drift check model %s: KS D=%s p=%s, PSI=%s', mid, ks.D, ks.p, psiVal);
          if (ks.p < this.pValueThreshold || psiVal > this.psiThreshold) {
            const severity = psiVal > this.psiThreshold || ks.p < 0.01 ? 'high' : 'medium';
            const alert = alertRepo.create({ metric_name: 'prediction_distribution', p_value: ks.p, psi: psiVal, severity, details: { model_id: mid, recent_count: recs.length } });
            await alertRepo.save(alert as any);
            await this.notify(alert);
          }
        } else {
          logger.info('No baseline available for model %s, skipping KS/PSI', mid);
        }
      } catch (e) {
        logger.warn('Drift check failed for model %s: %s', mid, (e as Error).message);
      }
    }
  }

  async notify(alert: any) {
    // send Slack
    try {
      const webhook = process.env.SLACK_WEBHOOK_URL;
      if (webhook) {
        await axios.post(webhook, { text: `Drift detected: ${alert.metric_name} severity=${alert.severity} psi=${alert.psi} p=${alert.p_value}` });
      }
    } catch (e) {
      logger.warn('Slack notify failed: %s', (e as Error).message);
    }

    // send email
    try {
      const to = process.env.ALERT_EMAIL_TO;
      if (to) {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || 'localhost',
          port: parseInt(process.env.SMTP_PORT || '25', 10),
          secure: (process.env.SMTP_SECURE || 'false') === 'true',
          auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
        } as any);
        await transporter.sendMail({ from: process.env.ALERT_EMAIL_FROM || 'alerts@example.com', to, subject: `Drift alert: ${alert.metric_name}`, text: JSON.stringify(alert) });
      }
    } catch (e) {
      logger.warn('Email notify failed: %s', (e as Error).message);
    }
  }

  async listAlerts(activeOnly = true) {
    await this.ensureInit();
    const repo = this.dataSource.getRepository(DriftAlert);
    if (activeOnly) {
      // last 7 days
      const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
      return await repo.createQueryBuilder('a').where('a.detected_at >= :since', { since }).orderBy('a.detected_at', 'DESC').getMany();
    }
    return await repo.find({ order: { detected_at: 'DESC' } });
  }
}

export default new DriftDetectorService();
