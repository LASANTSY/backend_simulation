import express, { Request, Response } from 'express';
import optimizerService from './optimizer.service';

const router = express.Router();

// POST /simulations/:id/optimize
router.post('/simulations/:id/optimize', async (req: Request, res: Response) => {
  const id = req.params.id;
  try {
    const result = await optimizerService.recommendTiming(id);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: String(err) });
  }
});

export default router;
