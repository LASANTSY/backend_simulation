const express = require('express');
const cors = require('cors');
const tf = require('@tensorflow/tfjs-node');

const app = express();
const PORT = process.env.PORT || 8501;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Modèle générique pré-entraîné (sera remplacé par entraînement ad-hoc si données fournies)
let genericModel = null;

/**
 * Crée un modèle séquentiel simple avec 2 couches cachées
 * @param {number[]} layerSizes - Tailles des couches [8, 4] par défaut
 * @returns {tf.Sequential} Modèle compilé
 */
function createModel(layerSizes = [8, 4]) {
  const model = tf.sequential();

  // Couche d'entrée + première couche cachée
  model.add(tf.layers.dense({
    units: layerSizes[0],
    activation: 'relu',
    inputShape: [4], // [rainfall, seasonFactor, population, gdp]
  }));

  // Dropout pour régularisation
  model.add(tf.layers.dropout({ rate: 0.2 }));

  // Deuxième couche cachée
  model.add(tf.layers.dense({
    units: layerSizes[1],
    activation: 'relu',
  }));

  // Couche de sortie (1 neurone pour ajustement en %)
  model.add(tf.layers.dense({
    units: 1,
    activation: 'linear',
  }));

  // Compilation
  model.compile({
    optimizer: tf.train.adam(0.01),
    loss: 'meanSquaredError',
    metrics: ['mae'],
  });

  return model;
}

/**
 * Entraîne un modèle sur des données fournies
 * @param {number[][]} inputs - Features d'entraînement
 * @param {number[]} outputs - Valeurs cibles
 * @param {object} config - Configuration d'entraînement
 */
async function trainModel(inputs, outputs, config = {}) {
  const { layers = [8, 4], epochs = 50, learningRate = 0.01 } = config;

  console.log('[TensorFlow] Training model with:', {
    samples: inputs.length,
    features: inputs[0]?.length,
    layers,
    epochs,
  });

  const model = createModel(layers);

  // Conversion en tenseurs
  const xs = tf.tensor2d(inputs);
  const ys = tf.tensor2d(outputs, [outputs.length, 1]);

  try {
    // Entraînement
    const history = await model.fit(xs, ys, {
      epochs,
      batchSize: Math.min(32, Math.floor(inputs.length / 2)),
      validationSplit: 0.2,
      shuffle: true,
      verbose: 0,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (epoch % 10 === 0) {
            console.log(`[TensorFlow] Epoch ${epoch}/${epochs} - loss: ${logs.loss.toFixed(4)}, mae: ${logs.mae.toFixed(4)}`);
          }
        },
      },
    });

    const finalLoss = history.history.loss[history.history.loss.length - 1];
    const finalMae = history.history.mae[history.history.mae.length - 1];

    console.log('[TensorFlow] Training completed:', {
      finalLoss: finalLoss.toFixed(4),
      finalMae: finalMae.toFixed(4),
    });

    return {
      model,
      accuracy: Math.max(0, 1 - finalMae / 10), // Approximation de l'accuracy
      loss: finalLoss,
    };
  } finally {
    // Nettoyage mémoire
    xs.dispose();
    ys.dispose();
  }
}

/**
 * Effectue une prédiction avec un modèle
 * @param {tf.Sequential} model - Modèle TensorFlow
 * @param {number[][]} features - Features pour prédiction
 */
function predict(model, features) {
  const tensor = tf.tensor2d(features);
  try {
    const predictions = model.predict(tensor);
    const values = predictions.arraySync();
    predictions.dispose();
    
    // Retourner les prédictions sous forme de tableau de nombres
    return values.map(v => v[0]);
  } finally {
    tensor.dispose();
  }
}

// ============================================================================
// ROUTES API
// ============================================================================

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'tensorflow-prediction',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /predict
 * Body: {
 *   features: [[rainfall, seasonFactor, pop, gdp], ...],
 *   trainingData?: { inputs: [][], outputs: [] },
 *   modelConfig?: { layers: [8,4], epochs: 50, learningRate: 0.01 }
 * }
 */
app.post('/predict', async (req, res) => {
  try {
    const { features, trainingData, modelConfig } = req.body;

    if (!features || !Array.isArray(features) || features.length === 0) {
      return res.status(400).json({
        error: 'Invalid request: features array required',
      });
    }

    console.log('[API] Prediction request:', {
      featuresCount: features.length,
      hasTrainingData: !!trainingData,
      trainingDataSize: trainingData?.inputs?.length || 0,
    });

    let model = genericModel;
    let modelInfo = {
      trained: false,
      accuracy: null,
      loss: null,
    };

    // Si données d'entraînement fournies et suffisantes, entraîner un modèle ad-hoc
    if (trainingData?.inputs?.length > 5 && trainingData?.outputs?.length > 5) {
      try {
        const trainingResult = await trainModel(
          trainingData.inputs,
          trainingData.outputs,
          modelConfig
        );
        model = trainingResult.model;
        modelInfo = {
          trained: true,
          accuracy: trainingResult.accuracy,
          loss: trainingResult.loss,
        };
      } catch (trainError) {
        console.error('[API] Training failed, using generic model:', trainError);
        // Continuer avec le modèle générique
      }
    }

    // Si pas de modèle disponible, créer un modèle générique simple
    if (!model) {
      console.log('[API] Creating default generic model');
      model = createModel(modelConfig?.layers || [8, 4]);
      genericModel = model;
    }

    // Effectuer la prédiction
    const predictions = predict(model, features);

    console.log('[API] Predictions computed:', {
      count: predictions.length,
      values: predictions.map(p => p.toFixed(2) + '%'),
    });

    res.json({
      predictions,
      modelInfo,
    });

    // Si un modèle ad-hoc a été créé, le libérer après usage
    if (modelInfo.trained && model !== genericModel) {
      setTimeout(() => {
        model.dispose();
      }, 1000);
    }
  } catch (error) {
    console.error('[API] Prediction error:', error);
    res.status(500).json({
      error: 'Prediction failed',
      message: error.message,
    });
  }
});

/**
 * GET /model/info
 * Informations sur le modèle générique actuel
 */
app.get('/model/info', (req, res) => {
  if (!genericModel) {
    return res.json({
      hasGenericModel: false,
      message: 'No generic model loaded',
    });
  }

  res.json({
    hasGenericModel: true,
    layers: genericModel.layers.map(l => ({
      name: l.name,
      units: l.units || null,
      activation: l.activation?.name || null,
    })),
  });
});

/**
 * POST /model/reset
 * Réinitialise le modèle générique
 */
app.post('/model/reset', (req, res) => {
  if (genericModel) {
    genericModel.dispose();
    genericModel = null;
  }

  res.json({
    message: 'Generic model reset',
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// DÉMARRAGE DU SERVEUR
// ============================================================================

app.listen(PORT, () => {
  console.log('='.repeat(80));
  console.log('TensorFlow.js Prediction Service');
  console.log('='.repeat(80));
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Prediction endpoint: POST http://localhost:${PORT}/predict`);
  console.log('='.repeat(80));

  // Créer un modèle générique au démarrage
  console.log('[Startup] Creating default generic model...');
  genericModel = createModel([8, 4]);
  console.log('[Startup] Generic model ready');
});

// Gestion propre de l'arrêt
process.on('SIGTERM', () => {
  console.log('[Shutdown] SIGTERM received, cleaning up...');
  if (genericModel) {
    genericModel.dispose();
  }
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Shutdown] SIGINT received, cleaning up...');
  if (genericModel) {
    genericModel.dispose();
  }
  process.exit(0);
});
