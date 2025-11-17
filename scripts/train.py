#!/usr/bin/env python3
import sys
import json
import os
from datetime import datetime

# Simple placeholder training script for demo purposes.
# Usage: python scripts/train.py <params.json> <output_dir>

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(json.dumps({'error': 'missing args'}))
        sys.exit(2)

    params_path = sys.argv[1]
    output_dir = sys.argv[2]

    with open(params_path, 'r') as f:
        params = json.load(f)

    dataset_id = params.get('datasetId')
    hyperparams = params.get('hyperparams', {})
    framework = params.get('framework', 'sklearn')

    # Simulate training: write a dummy model file
    ts = datetime.utcnow().strftime('%Y%m%dT%H%M%S')
    model_name = f'model-{framework}-{ts}.bin'
    model_path = os.path.join(output_dir, model_name)

    os.makedirs(output_dir, exist_ok=True)
    with open(model_path, 'wb') as mf:
        mf.write(b'DUMMY MODEL FOR ' + bytes(str(hyperparams), 'utf-8'))

    # Simulate metrics
    metrics = {
        'MSE': 0.123,
        'MAE': 0.045
    }

    # Output JSON to stdout so the Node service can parse it
    out = {'model_path': model_path, 'metrics': metrics}
    print(json.dumps(out))
    sys.exit(0)
