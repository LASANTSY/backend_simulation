import express, { Request, Response } from 'express';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import CreateLabelDto from './dto/create-label.dto';
import DataLabelingService from './data-labeling.service';

const router = express.Router();
const service = DataLabelingService;

// POST /data/label
router.post('/data/label', async (req: Request, res: Response) => {
  const dto = plainToInstance(CreateLabelDto, req.body);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: false });
  if (errors.length > 0) return res.status(400).json({ errors });

  try {
    const created = await service.createLabels(dto.dataset_id, dto.labels as any);
    res.status(201).json(created);
  } catch (e) {
    res.status(500).json({ message: 'Failed to create labels', error: (e as Error).message });
  }
});

// GET /data/labels/:datasetId
router.get('/data/labels/:datasetId', async (req: Request, res: Response) => {
  const datasetId = req.params.datasetId;
  try {
    const items = await service.findByDataset(datasetId);
    res.json(items);
  } catch (e) {
    res.status(500).json({ message: (e as Error).message });
  }
});

// DELETE /data/labels/:id
router.delete('/data/labels/:id', async (req: Request, res: Response) => {
  const id = req.params.id;
  try {
    const ok = await service.remove(id);
    if (!ok) return res.status(404).json({ message: 'Not found' });
    res.status(204).send();
  } catch (e) {
    res.status(500).json({ message: (e as Error).message });
  }
});

export default router;
