import express, { Request, Response } from 'express';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CityQueryDto } from './dto/city-query.dto';
import { PlaceService } from './place.service';

const router = express.Router();
const service = new PlaceService();

// GET /places/bbox?city=...
router.get('/places/bbox', async (req: Request, res: Response) => {
  const dto = plainToInstance(CityQueryDto, req.query);
  const errors = await validate(dto as any, { whitelist: true, forbidNonWhitelisted: false });
  if (errors.length > 0) return res.status(400).json({ errors });

  try {
    const bbox = await service.getCityBBox(dto.city);
    return res.json(bbox);
  } catch (err: any) {
    if (err?.message === 'not_found') return res.status(404).json({ message: 'City not found' });
    if (err?.message === 'timeout') return res.status(504).json({ message: 'OSM service timed out' });
    console.error('PlaceService error', err);
    return res.status(502).json({ message: 'Failed to fetch city bbox' });
  }
});

export default router;
