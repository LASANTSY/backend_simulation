import fs from 'fs';
import path from 'path';
import { predictWithModel, findModelPathFromRegistry } from './helpers/predictor';

const FIXTURE = path.join(__dirname, 'fixtures', 'model-outputs.json');
const TOL = 0.05; // 5% tolerance

describe('Model regression tests', () => {
  let inputs: number[];
  let expected: number[];
  let modelPath: string;

  beforeAll(async () => {
    const raw = fs.readFileSync(FIXTURE, 'utf-8');
    const parsed = JSON.parse(raw);
    inputs = parsed.inputs;
    expected = parsed.expected;
    modelPath = (await findModelPathFromRegistry()) || path.join(__dirname, 'fixtures', 'dummy-model.bin');
  });

  test('regression: predictions close to fixture within ±5%', () => {
    const preds = predictWithModel(modelPath, inputs);
    expect(preds.length).toBe(expected.length);
    for (let i = 0; i < preds.length; i++) {
      const p = preds[i];
      const e = expected[i];
      const diff = Math.abs(p - e);
      const rel = e === 0 ? diff : diff / Math.abs(e);
      expect(rel).toBeLessThanOrEqual(TOL);
    }
  });

  test('invariance: same input yields same output', () => {
    const a = predictWithModel(modelPath, inputs);
    const b = predictWithModel(modelPath, inputs);
    expect(a).toEqual(b);
  });

  test('robustness: small perturbations should not change outputs drastically', () => {
    const perturb = inputs.map((v) => v * 1.01); // +1%
    const base = predictWithModel(modelPath, inputs);
    const pert = predictWithModel(modelPath, perturb);
    // allow up to 10% relative change between base and perturbed predictions
    const maxRel = 0.1;
    for (let i = 0; i < base.length; i++) {
      const b = base[i];
      const p = pert[i];
      const diff = Math.abs(b - p);
      const rel = Math.abs(b) === 0 ? diff : diff / Math.abs(b);
      expect(rel).toBeLessThanOrEqual(maxRel);
    }
  });
});
