#!/usr/bin/env python3
import sys
import json
import os

# Usage: python scripts/predict.py <model_path> <input_json> <output_json>
# input_json: {"inputs": [x1, x2, ...]} where xi are numeric features or single values
# This is a simple predictor: if model is a sklearn pickle, try to load and predict; otherwise fallback to passthrough.

try:
    import joblib
except Exception:
    joblib = None

if __name__ == '__main__':
    if len(sys.argv) < 4:
        print(json.dumps({'error': 'missing args'}))
        sys.exit(2)

    model_path = sys.argv[1]
    in_path = sys.argv[2]
    out_path = sys.argv[3]

    with open(in_path, 'r') as f:
        payload = json.load(f)

    inputs = payload.get('inputs', [])

    predictions = []

    # try sklearn joblib
    if joblib and os.path.exists(model_path):
        try:
            m = joblib.load(model_path)
            # prepare X; if inputs is 1D array use reshape
            import numpy as np
            X = np.array(inputs)
            if X.ndim == 1:
                X = X.reshape(-1, 1)
            preds = m.predict(X)
            predictions = preds.tolist()
        except Exception as e:
            # fallback: simple identity/persistence
            predictions = [float(x) for x in inputs]
    else:
        # fallback: echo inputs or shift by one (persistence)
        if len(inputs) > 1:
            predictions = [inputs[i - 1] if i > 0 else inputs[0] for i in range(len(inputs))]
        else:
            predictions = inputs

    out = {'predictions': predictions}
    with open(out_path, 'w') as f:
        json.dump(out, f)
    print(json.dumps(out))
    sys.exit(0)
