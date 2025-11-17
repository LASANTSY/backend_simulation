import axios from 'axios';
import fs from 'fs';
import path from 'path';
import logger from '../etl/logger';

const TRACKING_URI = process.env.MLFLOW_TRACKING_URI || 'http://localhost:5000';
const LOCAL_MLRUNS_DIR = process.env.MLFLOW_LOCAL_MLRUNS_DIR || path.join(process.cwd(), 'mlruns');

function apiUrl(pathSuffix: string) {
  return `${TRACKING_URI.replace(/\/$/, '')}/api/2.0/mlflow${pathSuffix}`;
}

export class ModelRegistryService {
  // Create or get experiment by name
  async getOrCreateExperiment(experimentName = 'default') {
    try {
      const listUrl = apiUrl('/experiments/list');
      const res = await axios.get(listUrl);
      const experiments = res.data?.experiments || [];
      const found = experiments.find((e: any) => e.name === experimentName);
      if (found) return found;

      const createUrl = apiUrl('/experiments/create');
      const createRes = await axios.post(createUrl, { name: experimentName });
      return { experiment_id: createRes.data.experiment_id, name: experimentName };
    } catch (e) {
      logger.warn('getOrCreateExperiment failed, defaulting to id 0: %s', (e as Error).message);
      return { experiment_id: '0', name: experimentName };
    }
  }

  // Start a new run and return run_id
  async startRun(experimentId: string) {
    const url = apiUrl('/runs/create');
    const res = await axios.post(url, { experiment_id: experimentId });
    return res.data?.run?.info?.run_id;
  }

  async logParams(runId: string, params: Record<string, any>) {
    const url = apiUrl('/runs/log-batch');
    const paramArray = Object.keys(params).map((k) => ({ key: k, value: String(params[k]) }));
    await axios.post(url, { run_id: runId, params: paramArray });
  }

  async logMetrics(runId: string, metrics: Record<string, number>) {
    const url = apiUrl('/runs/log-batch');
    const metricArray = Object.keys(metrics).map((k) => ({ key: k, value: Number(metrics[k]), timestamp: Date.now(), step: 0 }));
    await axios.post(url, { run_id: runId, metrics: metricArray });
  }

  // Simple artifact writer: writes file into local mlruns folder so local mlflow server can serve it
  async logArtifact(runId: string, artifactPath: string, contents: Buffer | string) {
    try {
      // Attempt to find experiment and run folder under LOCAL_MLRUNS_DIR
      // This works when MLflow server uses local file store with default layout
      // Fallback: create a run folder under LOCAL_MLRUNS_DIR/manual/<runId>/artifacts
      const base = LOCAL_MLRUNS_DIR;
      const artifactDir = path.join(base, 'manual', runId, 'artifacts');
      fs.mkdirSync(artifactDir, { recursive: true });
      const outFile = path.join(artifactDir, artifactPath);
      fs.writeFileSync(outFile, contents);
      logger.info('Wrote artifact to %s', outFile);
      return outFile;
    } catch (e) {
      logger.warn('logArtifact failed: %s', (e as Error).message);
      throw e;
    }
  }

  // Convenience: run logging (params + metrics + optional artifact buffer)
  async logRun(experimentName: string, params: Record<string, any>, metrics: Record<string, number>, artifact?: { path: string; data: Buffer | string }) {
    const exp = await this.getOrCreateExperiment(experimentName);
    const runId = await this.startRun(exp.experiment_id);
    if (!runId) throw new Error('Failed to start run');
    await this.logParams(runId, params);
    await this.logMetrics(runId, metrics);
    if (artifact) {
      await this.logArtifact(runId, artifact.path, artifact.data);
    }
    return { experiment: exp, runId };
  }

  // List runs: fetch experiments then runs for each
  async listRegistry(limitPerExperiment = 10) {
    try {
      const listUrl = apiUrl('/experiments/list');
      const res = await axios.get(listUrl);
      const experiments = res.data?.experiments || [];
      const out: any[] = [];
      for (const e of experiments) {
        const searchUrl = apiUrl('/runs/search');
        const body = { experiment_ids: [e.experiment_id], max_results: limitPerExperiment };
        const runsRes = await axios.post(searchUrl, body);
        const runs = runsRes.data?.runs || [];
        out.push({ experiment: e, runs });
      }
      return out;
    } catch (err) {
      logger.error('listRegistry failed: %s', (err as Error).message);
      throw err;
    }
  }
}

export default new ModelRegistryService();
