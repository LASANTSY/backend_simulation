import express from 'express';
import SecretsService from './secrets.service';

const router = express.Router();

router.get('/secrets/:key', async (req, res) => {
  const key = req.params.key;
  try {
    const v = await SecretsService.getSecret(key);
    res.json({ key, value: v });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.post('/secrets/rotate', async (req, res) => {
  try {
    const token = await SecretsService.rotateToken();
    res.json({ token });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.post('/secrets/migrate', async (req, res) => {
  const keys = req.body.keys || [];
  try {
    const ok = await SecretsService.migrateFromEnv(keys);
    res.json({ ok });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
