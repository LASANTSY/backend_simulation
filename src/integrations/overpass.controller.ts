import express, { Request, Response } from 'express';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { OverpassService } from './overpass.service';
import { BboxQueryDto } from './dto/bbox-query.dto';

const router = express.Router();
const service = new OverpassService();

// GET /markets?south=...&west=...&north=...&east=...
router.get('/markets', async (req: Request, res: Response) => {
  const dto = plainToInstance(BboxQueryDto, req.query);
  const errors = await validate(dto as any, { whitelist: true, forbidNonWhitelisted: false });
  if (errors.length > 0) return res.status(400).json({ errors });

  try {
    const results = await service.fetchAndStoreMarkets(dto as any);
    res.json(results);
  } catch (err: any) {
    console.error('Overpass fetch error', err);
    res.status(502).json({ message: 'Failed to fetch marketplaces', error: String(err) });
  }
});

export default router;
