import express, { Request, Response } from 'express';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateSimulationDto } from './dto/create-simulation.dto';
import simulationService from './simulation.service';

const router = express.Router();

// POST /simulations -> create and run simulation
router.post('/simulations', async (req: Request, res: Response) => {
  const dto = plainToInstance(CreateSimulationDto, req.body);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: false });
  if (errors.length > 0) return res.status(400).json({ errors });

  try {
    const result = await simulationService.createAndRunSimulation({
      revenueId: dto.revenueId,
      newAmount: dto.newAmount,
      frequency: dto.frequency,
      durationMonths: dto.durationMonths,
      startDate: dto.startDate,
      note: dto.note,
      weatherContext: dto.weatherContext,
      economicContext: dto.economicContext,
      demographicContext: dto.demographicContext,
    });
    res.status(201).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Simulation failed', error: String(err) });
  }
});

// GET /simulations
router.get('/simulations', async (req: Request, res: Response) => {
  const municipalityId = (req.query.municipalityId as string) || undefined;
  const sims = await simulationService.findAllSimulations(municipalityId);
  res.json(sims);
});

// GET /simulations/:id
router.get('/simulations/:id', async (req: Request, res: Response) => {
  const id = req.params.id;
  const s = await simulationService.findSimulation(id);
  if (!s) return res.status(404).json({ message: 'Not found' });
  res.json(s);
});

// GET /analysis-results (all)
router.get('/analysis-results', async (_req: Request, res: Response) => {
  const repo = (await import('../data-source')).default.getRepository('AnalysisResult' as any);
  const items = await repo.find({ order: { createdAt: 'DESC' } });
  res.json(items);
});

export default router;
