import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const BASE_URL = process.env.TSIRY_BASE_URL || process.env.BASE_URL || 'https://gateway.tsirylab.com';
const TIMEOUT = parseInt(process.env.TSIRY_TIMEOUT || '10000', 10);

export class TransactionService {
  baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || BASE_URL;
  }

  // Fetch transactions for a municipality. Returns the parsed 'data' array from the API.
  async fetchTransactions(municipalityId: string) {
    if (!municipalityId) throw new Error('municipalityId required');
    const url = `${this.baseUrl.replace(/\/$/, '')}/servicepaiement/transactions/${encodeURIComponent(municipalityId)}`;
    try {
      const resp = await axios.get(url, { timeout: TIMEOUT });
      // The API returns { message, data: [...], status }
      if (resp && resp.data) {
        return resp.data;
      }
      throw new Error('Empty response from transactions provider');
    } catch (err: any) {
      // normalize error
      const msg = err?.response?.data ? JSON.stringify(err.response.data) : err?.message || String(err);
      throw new Error(`Transactions fetch failed: ${msg}`);
    }
  }
}

export default new TransactionService();
