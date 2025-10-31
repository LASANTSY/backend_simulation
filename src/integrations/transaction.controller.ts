import express, { Request, Response } from 'express';
import transactionService from './transaction.service';

const router = express.Router();

// Proxy endpoint to retrieve transactions for a municipality
router.get('/external/transactions/:municipalityId', async (req: Request, res: Response) => {
  const municipalityId = req.params.municipalityId;
  if (!municipalityId) return res.status(400).json({ message: 'municipalityId is required' });
  try {
    const result = await transactionService.fetchTransactions(municipalityId);
    // Return the raw API response so caller has message/status/data
    res.json(result);
  } catch (err: any) {
    console.error('Transactions fetch error', err);
    res.status(502).json({ message: 'Failed to fetch transactions', error: String(err) });
  }
});

export default router;
