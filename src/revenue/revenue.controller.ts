import express, { Request, Response } from 'express';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateRevenueDto } from './dto/create-revenue.dto';
import { UpdateRevenueDto } from './dto/update-revenue.dto';
import { RevenueService } from './revenue.service';

const router = express.Router();
const service = new RevenueService();

/**
 * @openapi
 * /serviceprediction/revenues:
 *   get:
 *     summary: List revenues
 *     tags:
 *       - revenue
 *     responses:
 *       200:
 *         description: OK
 */
// GET /revenues
router.get('/revenues', async (req: Request, res: Response) => {
  const municipalityId = (req.query.municipalityId as string) || undefined;
  const items = await service.findAll(municipalityId);
  res.json(items);
});

// GET /revenues/:id
router.get('/revenues/:id', async (req: Request, res: Response) => {
  const id = req.params.id;
  const item = await service.findOne(id);
  if (!item) return res.status(404).json({ message: 'Revenue not found' });
  res.json(item);
});

/**
 * @openapi
 * /serviceprediction/revenues:
 *   post:
 *     summary: Create a revenue
 *     tags:
 *       - revenue
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateRevenueDto'
 *     responses:
 *       201:
 *         description: Created
 */
// POST /revenues
router.post('/revenues', async (req: Request, res: Response) => {
  // Support two modes:
  // 1) Sync-only: body contains { municipality_id: '...' } or { municipalityId: '...' } (no CreateRevenueDto fields)
  // 2) Create revenue (optionally triggers sync if municipalityId provided)
  try {
    const body = req.body || {};
    const municipalityIdFromBody = body.municipality_id || body.municipalityId || (body.parameters && body.parameters.municipality_id) || undefined;
    const isSyncOnly = !!(municipalityIdFromBody && !(body.amount || body.date || body.category));

    if (isSyncOnly) {
      console.info('[Revenues POST] sync-only request detected for municipalityId=', municipalityIdFromBody);
      const syncReport = await service.syncFromExternal(String(municipalityIdFromBody));
      return res.status(200).json({ syncReport });
    }

    // Otherwise validate CreateRevenueDto and proceed with create (+ optional sync)
    const dto = plainToInstance(CreateRevenueDto, req.body);
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: false });
    if (errors.length > 0) return res.status(400).json({ errors });

    let syncReport = null;
    if (municipalityIdFromBody) {
      console.info('[Revenues POST] starting external sync for municipalityId=', municipalityIdFromBody);
      syncReport = await service.syncFromExternal(String(municipalityIdFromBody));
      console.info('[Revenues POST] external sync report:', syncReport);
    }

    const created = await service.create(req.body);
    return res.status(201).json({ created, syncReport });
  } catch (err: any) {
    console.error('[Revenues POST] error creating revenue or syncing:', err);
    return res.status(500).json({ message: 'Failed to create revenue or sync external transactions', error: String(err) });
  }
});

/**
 * @openapi
 * /serviceprediction/revenues/{id}:
 *   put:
 *     summary: Update a revenue
 *     tags:
 *       - revenue
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateRevenueDto'
 *     responses:
 *       200:
 *         description: OK
 */
// PUT /revenues/:id
router.put('/revenues/:id', async (req: Request, res: Response) => {
  const id = req.params.id;
  const dto = plainToInstance(UpdateRevenueDto, req.body);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: false });
  if (errors.length > 0) return res.status(400).json({ errors });
  const updated = await service.update(id, req.body);
  if (!updated) return res.status(404).json({ message: 'Revenue not found' });
  res.json(updated);
});

// DELETE /revenues/:id
router.delete('/revenues/:id', async (req: Request, res: Response) => {
  const id = req.params.id;
  const ok = await service.remove(id);
  if (!ok) return res.status(404).json({ message: 'Revenue not found' });
  res.status(204).send();
});

export default router;
