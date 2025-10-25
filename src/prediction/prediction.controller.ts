import express, { Request, Response } from 'express';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import predictionService from './prediction.service';
import { PredictionRunDto } from './dto/prediction-run.dto';

const router = express.Router();

// Trigger prediction run
router.post('/predictions/run', async (req: Request, res: Response) => {
  const dto = plainToInstance(PredictionRunDto, req.body || {});
  const errors = await validate(dto);
  if (errors.length > 0) return res.status(400).json({ errors });
  const months = Number(dto.months || 12);
  const years = Number(dto.years || 3);
  try {
    await predictionService.runAll(months, years);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Prediction failed', error: String(err) });
  }
});

// List predictions
router.get('/predictions', async (req: Request, res: Response) => {
  const preds = await predictionService['predictionRepo'].find({ order: { predictedDate: 'ASC' } });
  res.json(preds);
});

// Get by id
router.get('/predictions/:id', async (req: Request, res: Response) => {
  const id = req.params.id;
  const p = await predictionService['predictionRepo'].findOneBy({ id });
  if (!p) return res.status(404).json({ message: 'Not found' });
  res.json(p);
});

export default router;
