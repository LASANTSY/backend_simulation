import vault from 'node-vault';
import logger from '../etl/logger';
import AppDataSource from '../data-source';
import { DataSource } from 'typeorm';
import SecretAccess from '../entities/SecretAccess';

type CacheItem = { value: any; ts: number };

export class SecretsService {
  private client: any;
  private cache: Map<string, CacheItem> = new Map();
  private ttlMs: number;
  private dataSource: DataSource;

  constructor() {
    const endpoint = process.env.VAULT_ADDR || 'http://127.0.0.1:8200';
    const token = process.env.VAULT_TOKEN || 'root';
    this.client = vault({ endpoint, token });
    this.ttlMs = parseInt(process.env.SECRETS_CACHE_TTL_MS || String(60 * 60 * 1000), 10);
    this.dataSource = AppDataSource as unknown as DataSource;

    // background refresh every hour
    setInterval(() => this.refreshAll().catch((e) => logger.warn('Secrets refresh failed: %s', (e as Error).message)), this.ttlMs);
  }

  async getSecret(key: string) {
    const now = Date.now();
    const cached = this.cache.get(key);
    if (cached && now - cached.ts < this.ttlMs) {
      await this.logAccess(key, 'cache');
      return cached.value;
    }

    try {
      const res = await this.client.read(`secret/data/${key}`);
      // Vault KV v2 returns data.data
      const value = (res && res.data && (res.data.data || res.data)) || null;
      this.cache.set(key, { value, ts: Date.now() });
      await this.logAccess(key, 'vault');
      return value;
    } catch (e) {
      logger.warn('Failed to read secret %s: %s', key, (e as Error).message);
      return null;
    }
  }

  async setSecret(key: string, data: Record<string, any>) {
    try {
      await this.client.write(`secret/data/${key}`, { data });
      this.cache.set(key, { value: data, ts: Date.now() });
      return true;
    } catch (e) {
      logger.error('Failed to write secret %s: %s', key, (e as Error).message);
      return false;
    }
  }

  async migrateFromEnv(keys: string[], vaultPath = 'api-keys') {
    const payload: Record<string, any> = {};
    for (const k of keys) {
      if (process.env[k]) payload[k] = process.env[k];
    }
    if (Object.keys(payload).length === 0) return false;
    return await this.setSecret(vaultPath, payload);
  }

  async refreshAll() {
    for (const key of Array.from(this.cache.keys())) {
      try {
        const v = await this.getSecret(key);
        logger.info('Refreshed secret %s', key);
      } catch (e) {
        logger.warn('Failed refresh for %s: %s', key, (e as Error).message);
      }
    }
  }

  private async logAccess(key: string, source: string) {
    try {
      if (!(this.dataSource as any).isInitialized) await (this.dataSource as any).initialize();
      const repo = (this.dataSource as any).getRepository(SecretAccess);
      const rec = repo.create({ secret_key: key, source });
      await repo.save(rec as any);
    } catch (e) {
      logger.warn('Failed to log secret access: %s', (e as Error).message);
    }
  }

  async rotateToken() {
    try {
      // simple rotation: create a new token and replace env reference (note: requires higher privileges)
      const res = await this.client.tokenCreate({ renewable: true, ttl: '24h' });
      const newToken = res.auth.client_token;
      logger.info('Created new Vault token');
      // Not safe to overwrite process.env in real-world, but expose for manual update
      // Optionally store new token in Vault at secret/data/vault-token
      await this.setSecret('vault-token', { token: newToken });
      return newToken;
    } catch (e) {
      logger.error('Token rotation failed: %s', (e as Error).message);
      throw e;
    }
  }
}

export default new SecretsService();
