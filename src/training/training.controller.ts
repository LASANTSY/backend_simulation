import express from 'express';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import TrainingService from './training.service';
import { TrainModelDto } from './dto/train-model.dto';

const router = express.Router();

// POST /models/train
router.post('/models/train', async (req, res) => {
  const dto = plainToInstance(TrainModelDto, req.body);
  try {
    await validateOrReject(dto as any);
  } catch (errors) {
    return res.status(400).json({ errors });
  }

  try {
    const { dataset_id, hyperparams, framework } = dto as TrainModelDto;
    const result = await TrainingService.runTraining(dataset_id, hyperparams, framework || 'sklearn');
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
