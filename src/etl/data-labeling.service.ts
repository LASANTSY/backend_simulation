import fs from 'fs';
import path from 'path';
import { DataSource } from 'typeorm';
import AppDataSource from '../data-source';
import { LabeledDataset } from '../entities/LabeledDataset';
import logger from './logger';

export interface Label { [key: string]: any }

export class DataLabelingService {
  private dataSource: DataSource;
  private labeledDir: string;

  constructor(dataSource?: DataSource) {
    this.dataSource = dataSource || AppDataSource;
    this.labeledDir = process.env.DATA_LABELED_DIR || path.join(process.cwd(), 'data', 'labeled');
    fs.mkdirSync(this.labeledDir, { recursive: true });
  }

  async createLabels(datasetId: string, labels: Label[]): Promise<LabeledDataset[]> {
    // split labels into train/test/validation
    const splits = this.splitDataset(labels);

    await this.ensureDataSourceInitialized();
    const repo = this.dataSource.getRepository(LabeledDataset);

    const saved: LabeledDataset[] = [];
    for (const splitType of Object.keys(splits) as Array<'train'|'test'|'validation'>) {
      const subset = (splits as any)[splitType] as Label[];
      const entity = repo.create({ datasetId, labels: subset, splitType });
      const s = await repo.save(entity);
      saved.push(s as LabeledDataset);

      // export CSV
      try {
        await this.exportCsv(datasetId, splitType, subset);
      } catch (e) {
        logger.warn('CSV export failed: %s', (e as Error).message);
      }
    }

    return saved;
  }

  async findByDataset(datasetId: string): Promise<LabeledDataset[]> {
    await this.ensureDataSourceInitialized();
    const repo = this.dataSource.getRepository(LabeledDataset);
    return repo.find({ where: { datasetId } });
  }

  async remove(id: string): Promise<boolean> {
    await this.ensureDataSourceInitialized();
    const repo = this.dataSource.getRepository(LabeledDataset);
    const res = await repo.delete(id);
    return res.affected && res.affected > 0 ? true : false;
  }

  splitDataset(labels: Label[]): { train: Label[]; test: Label[]; validation: Label[] } {
    const total = labels.length;
    const shuffled = [...labels].sort(() => (Math.random() > 0.5 ? 1 : -1));

    const nTrain = Math.max(0, Math.round(total * 0.7));
    const nTest = Math.max(0, Math.round(total * 0.2));
    const nValidation = Math.max(0, total - nTrain - nTest);

    const train = shuffled.slice(0, nTrain);
    const test = shuffled.slice(nTrain, nTrain + nTest);
    const validation = shuffled.slice(nTrain + nTest, nTrain + nTest + nValidation);

    return { train, test, validation };
  }

  async exportCsv(datasetId: string, splitType: string, labels: Label[]): Promise<string> {
    if (!labels || labels.length === 0) {
      logger.info('No labels to export for %s %s', datasetId, splitType);
      return '';
    }

    const keys = Array.from(new Set(labels.flatMap((l) => Object.keys(l))));
    const header = keys.join(',') + '\n';
    const rows = labels.map((l) => keys.map((k) => this.safeCsv(String((l as any)[k] ?? ''))).join(',')).join('\n');
    const csv = header + rows + '\n';

    const filename = path.join(this.labeledDir, `${datasetId}-${splitType}.csv`);
    fs.writeFileSync(filename, csv);
    logger.info('Exported CSV to %s', filename);
    return filename;
  }

  private safeCsv(value: string) {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
  }

  private async ensureDataSourceInitialized() {
    if (!this.dataSource.isInitialized) {
      await this.dataSource.initialize();
    }
  }
}

export default new DataLabelingService();
