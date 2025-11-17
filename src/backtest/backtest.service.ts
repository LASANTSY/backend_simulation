import AppDataSource from '../data-source';
import { DataSource } from 'typeorm';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import logger from '../etl/logger';
import TrainedModel from '../entities/TrainedModel';
import BacktestResult from '../entities/BacktestResult';

function mse(a: number[], b: number[]) {
  const n = a.length;
  let s = 0;
  for (let i = 0; i < n; i++) s += Math.pow(a[i] - b[i], 2);
  return s / n;
}

function mae(a: number[], b: number[]) {
  const n = a.length;
  let s = 0;
  for (let i = 0; i < n; i++) s += Math.abs(a[i] - b[i]);
  return s / n;
}

function rmse(a: number[], b: number[]) {
  return Math.sqrt(mse(a, b));
}

function mape(a: number[], b: number[]) {
  const n = a.length;
  let s = 0;
  for (let i = 0; i < n; i++) {
    if (a[i] === 0) continue;
    s += Math.abs((a[i] - b[i]) / a[i]);
  }
  return (s / n) * 100;
}

// Simple two-sample Kolmogorov-Smirnov statistic (D) and asymptotic p-value approx
function ksTest(sample1: number[], sample2: number[]) {
  const xs = sample1.slice().sort((a, b) => a - b);
  const ys = sample2.slice().sort((a, b) => a - b);
  const n1 = xs.length;
  const n2 = ys.length;
  const all = Array.from(new Set(xs.concat(ys))).sort((a, b) => a - b);
  let c1 = 0,
    c2 = 0;
  let d = 0;
  let i1 = 0,
    i2 = 0;
  for (const v of all) {
    while (i1 < n1 && xs[i1] <= v) {
      i1++;
    }
    while (i2 < n2 && ys[i2] <= v) {
      i2++;
    }
    c1 = i1 / n1;
    c2 = i2 / n2;
    d = Math.max(d, Math.abs(c1 - c2));
  }

  // approximate p-value using Kolmogorov distribution (for large n)
  const en = Math.sqrt((n1 * n2) / (n1 + n2));
  const lambda = (en + 0.12 + 0.11 / en) * d;
  // use approximation p ~ 2 * sum((-1)^(k-1) * exp(-2 * k^2 * lambda^2))
  let p = 0;
  for (let k = 1; k < 100; k++) {
    const term = Math.pow(-1, k - 1) * Math.exp(-2 * k * k * lambda * lambda);
    p += term;
    if (Math.abs(term) < 1e-8) break;
  }
  p = Math.min(Math.max(2 * p, 0), 1);
  return { D: d, p };
}

// Calibration (reliability diagram) by deciles
function reliabilityDiagram(preds: number[], actuals: number[]) {
  const n = preds.length;
  const idx = preds.map((p, i) => ({ p, a: actuals[i] }));
  idx.sort((x, y) => x.p - y.p);
  const bins: { pred_mean: number; obs_mean: number; count: number }[] = [];
  const binSize = Math.max(1, Math.floor(n / 10));
  for (let i = 0; i < 10; i++) {
    const start = i * binSize;
    const end = i === 9 ? n : Math.min(n, (i + 1) * binSize);
    const slice = idx.slice(start, end);
    if (slice.length === 0) continue;
    const pred_mean = slice.reduce((s, r) => s + r.p, 0) / slice.length;
    const obs_mean = slice.reduce((s, r) => s + r.a, 0) / slice.length;
    bins.push({ pred_mean, obs_mean, count: slice.length });
  }
  return bins;
}

export class BacktestService {
  private dataSource: DataSource;

  constructor(dataSource?: DataSource) {
    this.dataSource = dataSource || AppDataSource;
  }

  private async ensureInitialized() {
    if (!this.dataSource.isInitialized) await this.dataSource.initialize();
  }

  // Load historical data from Revenue table between period strings 'YYYY-MM' inclusive
  private async loadHistorical(start: string, end: string) {
    await this.ensureInitialized();
    const repo = this.dataSource.getRepository('Revenue');
    // assume Revenue has createdAt or date column
    const qb = repo.createQueryBuilder('r');
    qb.where("to_char(coalesce(r.date, r.createdAt), 'YYYY-MM') >= :start", { start });
    qb.andWhere("to_char(coalesce(r.date, r.createdAt), 'YYYY-MM') <= :end", { end });
    qb.orderBy('coalesce(r.date, r.createdAt)', 'ASC');
    const rows = await qb.getMany();
    // map to arrays of numbers
    const actuals = rows.map((r: any) => Number(r.amount || r.value || 0));
    const dates = rows.map((r: any) => (r.date || r.createdAt).toISOString());
    return { dates, actuals, raw: rows };
  }

  // Try to predict using Python predictor if model file exists and framework indicates python
  private async predictWithPython(modelPath: string, inputs: number[]) {
    // write inputs JSON
    const tmp = path.join(process.cwd(), 'tmp');
    fs.mkdirSync(tmp, { recursive: true });
    const inPath = path.join(tmp, `predict-in-${Date.now()}.json`);
    const outPath = path.join(tmp, `predict-out-${Date.now()}.json`);
    fs.writeFileSync(inPath, JSON.stringify({ inputs }));

    const script = path.join(process.cwd(), 'scripts', 'predict.py');
    return await new Promise<number[]>((resolve, reject) => {
      const py = spawn('python', [script, modelPath, inPath, outPath], { stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';
      py.stderr.on('data', (d) => (stderr += d.toString()));
      py.on('close', (code) => {
        if (code !== 0) {
          logger.warn('Python predictor failed: %s', stderr);
          return reject(new Error('Python predictor failed'));
        }
        try {
          const raw = fs.readFileSync(outPath, 'utf-8');
          const parsed = JSON.parse(raw);
          resolve(parsed.predictions || []);
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  async runBacktest(modelId: string, start: string, end: string) {
    await this.ensureInitialized();
    const modelRepo = this.dataSource.getRepository(TrainedModel);
    const model = await modelRepo.findOne({ where: { id: modelId } });
    if (!model) throw new Error('Model not found');

    const hist = await this.loadHistorical(start, end);
    const actuals = hist.actuals;
    let preds: number[] = [];

    // First try Python prediction if model path exists
    if (model.model_path && fs.existsSync(model.model_path)) {
      try {
        preds = await this.predictWithPython(model.model_path, actuals);
      } catch (e) {
        logger.warn('predictWithPython failed, falling back to naive forecast: %s', (e as Error).message);
      }
    }

    // fallback: naive persistence forecast (previous value)
    if (!preds || preds.length === 0) {
      preds = actuals.map((_, i) => (i === 0 ? actuals[0] : actuals[i - 1]));
    }

    const metrics = {
      MSE: mse(actuals, preds),
      MAE: mae(actuals, preds),
      RMSE: rmse(actuals, preds),
      MAPE: mape(actuals, preds),
    };

    const calibration = reliabilityDiagram(preds, actuals);

    // Data drift: compare training distribution if available in model.metrics.training_sample
    let drift = { D: null, p: null, note: 'training distribution not available in TrainedModel.metrics' } as any;
    try {
      const trainSample: number[] = (model.metrics && (model.metrics.training_sample as number[])) || [];
      if (trainSample && trainSample.length > 10) {
        drift = ksTest(trainSample, actuals);
      }
    } catch (e) {
      logger.warn('KS test failed: %s', (e as Error).message);
    }

    // persist BacktestResult
    const repo = this.dataSource.getRepository(BacktestResult);
    const rec = repo.create({ model_id: modelId, metrics: { ...metrics, calibration, drift }, predictions: preds, actuals, period_start: start, period_end: end });
    const saved = await repo.save(rec as any);

    return { saved, metrics, calibration, drift, dates: hist.dates };
  }
}

export default new BacktestService();
