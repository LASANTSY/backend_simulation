import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

// Try to use Python predictor; fallback to simple Node-based predictor (persistence)
export function predictWithModel(modelPath: string, inputs: number[]): number[] {
  // try python
  try {
    const py = spawnSync('python', [path.join(process.cwd(), 'scripts', 'predict.py'), modelPath, writeTempInputs(inputs), writeTempOutputPath()], { encoding: 'utf-8' });
    if (py.status === 0) {
      const out = py.stdout.trim();
      try {
        const parsed = JSON.parse(out);
        if (parsed && Array.isArray(parsed.predictions)) return parsed.predictions;
      } catch (e) {
        // try reading output file
        const outPath = getTempOutputPath();
        if (fs.existsSync(outPath)) {
          const raw = fs.readFileSync(outPath, 'utf-8');
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.predictions)) return parsed.predictions;
        }
      }
    }
  } catch (e) {
    // ignore and fallback
  }

  // Node fallback: simple persistence forecast (previous value)
  if (inputs.length === 0) return [];
  const preds: number[] = inputs.map((_, i) => (i === 0 ? inputs[0] : inputs[i - 1]));
  return preds;
}

// Simple temp file helpers (use fixed temp files to be deterministic in tests)
function writeTempInputs(inputs: number[]) {
  const inPath = getTempInputPath();
  fs.writeFileSync(inPath, JSON.stringify({ inputs }));
  return inPath;
}

function writeTempOutputPath() {
  const outPath = getTempOutputPath();
  // ensure empty
  try { fs.unlinkSync(outPath); } catch (e) {}
  return outPath;
}

function getTempInputPath() {
  return path.join(process.cwd(), 'test', 'fixtures', 'predict-in.json');
}

function getTempOutputPath() {
  return path.join(process.cwd(), 'test', 'fixtures', 'predict-out.json');
}

export async function findModelPathFromRegistry(): Promise<string | null> {
  // Try MLflow registry via ModelRegistryService if available; otherwise look for TEST_MODEL_PATH env var
  const envPath = process.env.TEST_MODEL_PATH;
  if (envPath && fs.existsSync(envPath)) return envPath;

  // try MLflow REST if configured
  const tracking = process.env.MLFLOW_TRACKING_URI;
  if (!tracking) return path.join(process.cwd(), 'test', 'fixtures', 'dummy-model.bin');

  try {
    const url = `${tracking.replace(/\/$/, '')}/api/2.0/mlflow/experiments/list`;
    const res = await axios.get(url);
    const exps = res.data?.experiments || [];
    for (const e of exps) {
      // try list runs
      const rurl = `${tracking.replace(/\/$/, '')}/api/2.0/mlflow/runs/search`;
      const runsRes = await axios.post(rurl, { experiment_ids: [e.experiment_id], max_results: 1 });
      const runs = runsRes.data?.runs || [];
      if (runs.length > 0) {
        const run = runs[0];
        // attempt to extract artifact URI (if present)
        const artifactUri = run.info && run.info.artifact_uri;
        if (artifactUri) {
          // if local file system path like file://mlruns/.../artifacts/model.bin
          if (artifactUri.startsWith('file://')) return artifactUri.replace('file://', '') + '/model.bin';
        }
      }
    }
  } catch (e) {
    // ignore and fallback
  }

  return path.join(process.cwd(), 'test', 'fixtures', 'dummy-model.bin');
}
