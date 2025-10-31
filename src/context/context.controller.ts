import express, { Request, Response } from 'express';
import contextService from './context.service';

const router = express.Router();

router.get('/context/weather', async (req: Request, res: Response) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const date = req.query.date as string | undefined;
  if (!lat || !lon) return res.status(400).json({ message: 'lat and lon required' });
  try {
    const data = await contextService.fetchWeather(lat, lon, date);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: String(err) });
  }
});

router.get('/context/economic', async (req: Request, res: Response) => {
  const country = (req.query.country || req.query.c) as string;
  const indicator = (req.query.indicator || req.query.i) as string;
  if (!country || !indicator) return res.status(400).json({ message: 'country and indicator required' });
  try {
    const data = await contextService.fetchEconomicIndicator(country, indicator);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: String(err) });
  }
});

router.get('/context/demographics', async (req: Request, res: Response) => {
  const country = (req.query.country || req.query.c) as string;
  if (!country) return res.status(400).json({ message: 'country required' });
  try {
    const data = await contextService.fetchDemographics(country);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: String(err) });
  }
});

export default router;
