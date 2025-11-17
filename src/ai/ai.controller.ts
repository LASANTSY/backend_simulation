import express, { Request, Response } from 'express';
import aiService from './ai.service';
import { getQueue } from './queue';

const router = express.Router();

// POST /analysis-results/:id/enrich
router.post('/analysis-results/:id/enrich', async (req: Request, res: Response) => {
  const id = req.params.id;
  const extraContext = req.body || {};
  try {
    const parsed = await aiService.enrichAnalysis(id, extraContext);
    res.json({ ok: true, parsed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// POST /ai/enrich -> enqueue an LLM enrichment job, return job id immediately
router.post('/ai/enrich', async (req: Request, res: Response) => {
  const { analysisId, extraContext, timeoutMs } = req.body || {};
  if (!analysisId) return res.status(400).json({ ok: false, error: 'analysisId required' });
  const q = getQueue();
  if (!q) return res.status(500).json({ ok: false, error: 'Queue not initialized' });

  try {
    const job = await q.add(
      'enrich',
      { analysisId, extraContext },
      {
        attempts: 3,
        backoff: { type: 'customDelays', opts: { delays: [1000, 5000, 15000] } },
        timeout: timeoutMs || 30000,
      } as any,
    );
    res.json({ ok: true, jobId: job.id });
  } catch (e) {
    console.error('Failed to enqueue job', e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// GET /ai/jobs/:id/status -> check job state and result
router.get('/ai/jobs/:id/status', async (req: Request, res: Response) => {
  const id = req.params.id;
  const q = getQueue();
  if (!q) return res.status(500).json({ ok: false, error: 'Queue not initialized' });
  try {
    const job = await q.getJob(id);
    if (!job) return res.status(404).json({ ok: false, error: 'Job not found' });
    const state = await job.getState();
    const ret = { ok: true, id: job.id, state, result: job.returnvalue ?? null, failedReason: job.failedReason ?? null };
    res.json(ret);
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

export default router;
