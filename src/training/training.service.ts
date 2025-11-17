import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { DataSource } from 'typeorm';
import AppDataSource from '../data-source';
import logger from '../etl/logger';
import TrainedModel from '../entities/TrainedModel';
import { dvcAdd, dvcCommit } from '../etl/dvc';

export class TrainingService {
  private dataSource: DataSource;
  private modelsDir: string;

  constructor(dataSource?: DataSource) {
    this.dataSource = dataSource || AppDataSource;
    this.modelsDir = process.env.MODELS_DIR || path.join(process.cwd(), 'models');
    fs.mkdirSync(this.modelsDir, { recursive: true });
  }

  async runTraining(datasetId: string, hyperparams: Record<string, any>, framework = 'sklearn') {
    logger.info('Starting training for dataset %s with hyperparams %o', datasetId, hyperparams);

    // write params to temp file
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const paramsPath = path.join(this.modelsDir, `train-params-${ts}.json`);
    fs.writeFileSync(paramsPath, JSON.stringify({ datasetId, hyperparams, framework }, null, 2));

    // call Python script: scripts/train.py <paramsPath> <outputDir>
    const script = process.env.TRAIN_SCRIPT_PATH || path.join(process.cwd(), 'scripts', 'train.py');
    const outputDir = this.modelsDir;

    return await new Promise<any>((resolve, reject) => {
      const py = spawn('python', [script, paramsPath, outputDir], { stdio: ['ignore', 'pipe', 'pipe'] });

      let stdout = '';
      let stderr = '';

      py.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      py.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      py.on('close', async (code) => {
        if (code !== 0) {
          logger.error('Training script failed (%d): %s', code, stderr);
          return reject(new Error(`Training script failed: ${stderr}`));
        }

        // Expect the Python script to output a JSON with { model_path, metrics }
        let result: any;
        try {
          result = JSON.parse(stdout.trim());
        } catch (e) {
          logger.error('Failed to parse training output: %s', (e as Error).message);
          return reject(new Error('Invalid training output'));
        }

        try {
          // persist TrainedModel entity
          await this.ensureInitialized();
          const repo = this.dataSource.getRepository(TrainedModel);
          const model = repo.create({ model_path: result.model_path, framework, hyperparams, metrics: result.metrics });
          const saved = await repo.save(model as any);

          // DVC: add and commit the model file
          try {
            await dvcAdd(result.model_path);
            dvcCommit(`Add trained model ${path.basename(result.model_path)}`);
          } catch (e) {
            logger.warn('DVC add/commit failed: %s', (e as Error).message);
          }

          resolve({ saved, result });
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  private async ensureInitialized() {
    if (!this.dataSource.isInitialized) await this.dataSource.initialize();
  }
}

export default new TrainingService();
