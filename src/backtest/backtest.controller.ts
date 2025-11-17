import express from 'express';
import BacktestService from './backtest.service';

const router = express.Router();

// GET /models/:id/backtest?start=YYYY-MM&end=YYYY-MM
router.get('/models/:id/backtest', async (req, res) => {
  const id = req.params.id;
  const start = (req.query.start as string) || '';
  const end = (req.query.end as string) || '';
  if (!start || !end) return res.status(400).json({ error: 'start and end query params required (YYYY-MM)' });

  try {
    const result = await BacktestService.runBacktest(id, start, end);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
