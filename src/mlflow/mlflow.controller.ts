import express from 'express';
import ModelRegistryService from './model-registry.service';

const router = express.Router();

// GET /models/registry
router.get('/models/registry', async (req, res) => {
  try {
    const data = await ModelRegistryService.listRegistry(20);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
