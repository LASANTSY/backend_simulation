import express from 'express';
import metrics from './metrics.service';

const router = express.Router();

router.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', metrics.register.contentType);
    const body = await metrics.register.metrics();
    res.send(body);
  } catch (e) {
    res.status(500).send('Error collecting metrics');
  }
});

export default router;
