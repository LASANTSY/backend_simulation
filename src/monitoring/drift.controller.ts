import express from 'express';
import DriftDetectorService from './drift-detector.service';

const router = express.Router();

router.get('/monitoring/drift', async (req, res) => {
  try {
    const alerts = await DriftDetectorService.listAlerts(true);
    res.json({ alerts });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
