import express, { Request, Response } from 'express';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import predictionService from './prediction.service';
import { PredictionRunDto } from './dto/prediction-run.dto';
import transactionService from '../integrations/transaction.service';

const router = express.Router();

// Public endpoint: run predictions based on external transactions for a municipality (no auth)
router.post('/predictions/run', async (req: Request, res: Response) => {
  const dto = plainToInstance(PredictionRunDto, req.body || {});
  const errors = await validate(dto);
  if (errors.length > 0) return res.status(400).json({ errors });

  const months = Number(dto.months || 12);
  const years = Number(dto.years || 3);
  const municipalityId = dto.municipalityId;

  if (!municipalityId) return res.status(400).json({ message: 'municipalityId is required for public predictions' });

  try {
    // fetch transactions
    const resp = await transactionService.fetchTransactions(String(municipalityId));
    const data = resp && resp.data ? resp.data : [];

    // aggregate by month and year
    const monthlyMap: Record<string, number> = {};
    const annualMap: Record<string, number> = {};

    for (const t of data) {
      const amt = parseFloat(t.amount || '0');
      const d = new Date(t.createdAt || t.updatedAt || Date.now());
      if (isNaN(amt)) continue;
      const y = d.getFullYear();
      const m = (d.getMonth() + 1).toString().padStart(2, '0');
      const ym = `${y}-${m}`;
      monthlyMap[ym] = (monthlyMap[ym] || 0) + amt;
      annualMap[String(y)] = (annualMap[String(y)] || 0) + amt;
    }

    // Build ordered series arrays
    const monthlyKeys = Object.keys(monthlyMap).sort();
    const monthlySeries = monthlyKeys.map((k) => monthlyMap[k]);
    const annualKeys = Object.keys(annualMap).sort();
    const annualSeries = annualKeys.map((k) => annualMap[k]);

    // Use predictionService algorithms directly
    const maWindow = 3;
    const maPreds = predictionService.movingAveragePredict(monthlySeries.slice(), maWindow, months);
    const lrMonthly = predictionService.linearRegressionPredict(monthlySeries.slice(), months);

    const monthlyPredictions: any[] = [];
    // compute next months dates based on last monthly key
    const lastMonthKey = monthlyKeys.length > 0 ? monthlyKeys[monthlyKeys.length - 1] : null; // 'YYYY-MM'
    let lastY = lastMonthKey ? parseInt(lastMonthKey.split('-')[0], 10) : new Date().getFullYear();
    let lastM = lastMonthKey ? parseInt(lastMonthKey.split('-')[1], 10) : new Date().getMonth() + 1;

    for (let i = 0; i < months; i++) {
      lastM += 1;
      if (lastM > 12) {
        lastM = 1;
        lastY += 1;
      }
      const monthStr = `${lastY.toString().padStart(4, '0')}-${lastM.toString().padStart(2, '0')}-01`;
      monthlyPredictions.push({ predictedDate: monthStr, amount: maPreds[i], model: `moving_average_${maWindow}`, period: 'monthly', municipalityId });
      monthlyPredictions.push({ predictedDate: monthStr, amount: lrMonthly.preds[i], lower: lrMonthly.lower[i], upper: lrMonthly.upper[i], model: 'linear_regression', period: 'monthly', municipalityId });
    }

    // Annual predictions
    const lrAnnual = predictionService.linearRegressionPredict(annualSeries.slice(), years);
    const annualPredictions: any[] = [];
    let lastYear = annualKeys.length > 0 ? parseInt(annualKeys[annualKeys.length - 1], 10) : new Date().getFullYear();
    for (let i = 0; i < years; i++) {
      lastYear += 1;
      const yearStr = `${lastYear}-01-01`;
      annualPredictions.push({ predictedDate: yearStr, amount: lrAnnual.preds[i], lower: lrAnnual.lower[i], upper: lrAnnual.upper[i], model: 'linear_regression', period: 'annual', municipalityId });
    }

    // persist predictions
    const saved = await predictionService.storePredictions([...monthlyPredictions, ...annualPredictions]);

    res.json({ ok: true, savedCount: Array.isArray(saved) ? saved.length : 0, sample: saved && saved.length ? saved[0] : null });
  } catch (err) {
    console.error('Public prediction error', err);
    res.status(500).json({ message: 'Prediction run failed', error: String(err) });
  }
});

export default router;
