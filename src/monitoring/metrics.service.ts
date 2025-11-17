import client from 'prom-client';

// Create default registry
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// Counters
export const totalPredictions = new client.Counter({
  name: 'total_predictions',
  help: 'Total number of predictions performed by the service',
});
export const apiErrors = new client.Counter({
  name: 'api_errors',
  help: 'Total number of API errors'
});

export const llmValidationFailures = new client.Counter({
  name: 'llm_validation_failures_total',
  help: 'Total number of LLM output validation failures'
});

// Histograms
export const predictionLatency = new client.Histogram({
  name: 'prediction_latency_seconds',
  help: 'Prediction latency in seconds',
  buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1, 2, 5]
});

// Gauges
export const activeModels = new client.Gauge({
  name: 'active_models',
  help: 'Number of active models loaded'
});

// Register metrics
register.registerMetric(totalPredictions);
register.registerMetric(apiErrors);
register.registerMetric(predictionLatency);
register.registerMetric(activeModels);
register.registerMetric(llmValidationFailures);

export default {
  register,
  totalPredictions,
  apiErrors,
  predictionLatency,
  activeModels
};
