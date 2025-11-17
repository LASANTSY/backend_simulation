import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { DataSource } from 'typeorm';
import logger from './logger';
import AppDataSource from '../data-source';
import { DataSetSchema, DataSet } from './schemas/dataset.schema';
import { dvcAdd, dvcCommit, dvcPush } from './dvc';

export class DataPipelineService {
  private dataDir: string;
  private rawDir: string;
  private processedDir: string;
  private dataSource: DataSource;

  constructor(dataSource?: DataSource) {
    this.dataSource = dataSource || AppDataSource;
    this.dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
    this.rawDir = process.env.DATA_RAW_DIR || path.join(this.dataDir, 'raw');
    this.processedDir = process.env.DATA_PROCESSED_DIR || path.join(this.dataDir, 'processed');

    // ensure dirs exist
    fs.mkdirSync(this.rawDir, { recursive: true });
    fs.mkdirSync(this.processedDir, { recursive: true });
  }

  async extract(): Promise<string> {
    logger.info('Starting extract phase');

    // Example: fetch latest revenues from DB
    await this.ensureDataSourceInitialized();
    const revenueRepo = this.dataSource.getRepository('Revenue');
    let dbData: any[] = [];
    try {
      dbData = await revenueRepo.find({ take: 100 });
      logger.info('Extracted %d rows from Revenue', dbData.length);
    } catch (e) {
      logger.warn('Failed to read Revenue repository: %s', (e as Error).message);
    }

    // Example: call an external API
    let extData: any[] = [];
    try {
      const res = await axios.get('https://api.exchangerate.host/latest?base=USD');
      // transform exchange rates into simple records
      const rates = res.data?.rates || {};
      extData = Object.keys(rates).slice(0, 10).map((k) => ({ date: new Date().toISOString(), value: rates[k], source: { name: 'exchangerate.host' }, metadata: { currency: k } }));
      logger.info('Extracted %d external rows from exchangerate.host', extData.length);
    } catch (e) {
      logger.warn('External API fetch failed: %s', (e as Error).message);
    }

    const combined = [...dbData.map((r: any) => ({ date: (r.date || r.createdAt || new Date()).toISOString(), value: r.amount || r.value || 0, source: { name: 'db', url: '' }, metadata: { id: r.id } })), ...extData];

    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = path.join(this.rawDir, `dataset-${ts}.json`);
    fs.writeFileSync(filename, JSON.stringify(combined, null, 2));
    logger.info('Wrote raw dataset to %s', filename);

    try {
      dvcAdd(filename);
      dvcCommit(`Add raw dataset ${path.basename(filename)}`);
    } catch (e) {
      logger.warn('DVC add/commit failed: %s', (e as Error).message);
    }

    return filename;
  }

  async transform(rawFilePath: string): Promise<string> {
    logger.info('Starting transform phase for %s', rawFilePath);
    const raw = JSON.parse(fs.readFileSync(rawFilePath, 'utf-8')) as unknown;

    // Zod validation / normalization
    let parsed: DataSet;
    try {
      parsed = DataSetSchema.parse(raw);
    } catch (e) {
      logger.error('Validation error during transform: %s', (e as Error).message);
      // attempt to coerce/clean loose data
      const coerced = (raw as any[]).map((r: any) => ({ date: r.date || new Date().toISOString(), value: Number(r.value || r.amount || 0), source: r.source || { name: 'unknown' }, metadata: r.metadata || {} }));
      parsed = DataSetSchema.parse(coerced);
    }

    // Basic transformation example: filter invalid values and round
    const processed = parsed.filter((r) => Number.isFinite(r.value)).map((r) => ({ ...r, value: Math.round(r.value * 100) / 100 }));

    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const outFile = path.join(this.processedDir, `processed-${ts}.json`);
    fs.writeFileSync(outFile, JSON.stringify(processed, null, 2));
    logger.info('Wrote processed dataset to %s', outFile);

    try {
      dvcAdd(outFile);
      dvcCommit(`Add processed dataset ${path.basename(outFile)}`);
      // optionally push
      if (process.env.DVC_AUTO_PUSH === 'true') {
        dvcPush();
      }
    } catch (e) {
      logger.warn('DVC add/commit/push failed: %s', (e as Error).message);
    }

    return outFile;
  }

  async load(processedFilePath: string): Promise<void> {
    logger.info('Starting load phase for %s', processedFilePath);
    const processed = JSON.parse(fs.readFileSync(processedFilePath, 'utf-8')) as any[];

    await this.ensureDataSourceInitialized();

    // Example: write into a `ProcessedRecord` table or reuse an existing one. We'll attempt to upsert into `Revenue` as example
    const repo = this.dataSource.getRepository('Revenue');

    try {
      for (const row of processed) {
        const entity: any = { amount: row.value, createdAt: new Date(row.date) };
        try {
          await repo.save(entity);
        } catch (e) {
          logger.warn('Failed to save row: %s', (e as Error).message);
        }
      }
      logger.info('Loaded %d records to DB (attempted)', processed.length);
    } catch (e) {
      logger.error('Load failed: %s', (e as Error).message);
      throw e;
    }
  }

  async runOnce(): Promise<void> {
    logger.info('Pipeline runOnce started');
    const raw = await this.extract();
    const processed = await this.transform(raw);
    await this.load(processed);
    logger.info('Pipeline runOnce finished');
  }

  private async ensureDataSourceInitialized() {
    if (!this.dataSource.isInitialized) {
      await this.dataSource.initialize();
    }
  }
}

export default new DataPipelineService();
