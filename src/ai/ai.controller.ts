import express, { Request, Response } from 'express';
import aiService from './ai.service';

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

export default router;
