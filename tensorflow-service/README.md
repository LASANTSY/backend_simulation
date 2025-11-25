# Service TensorFlow.js pour Prédictions Neuronales

Service API REST conteneurisé utilisant TensorFlow.js Node pour effectuer des prédictions de revenus fiscaux via un réseau de neurones simple.

## Architecture

- **Runtime**: Node.js 18 + TensorFlow.js Node
- **Modèle**: MLP (Multi-Layer Perceptron) avec 2 couches cachées [8, 4]
- **Entrées**: 4 features normalisées [rainfall, seasonFactor, population, GDP]
- **Sortie**: Ajustement prédit en % par rapport à une baseline

## Endpoints

### `GET /health`
Health check pour Docker et orchestration.

**Response:**
```json
{
  "status": "healthy",
  "service": "tensorflow-prediction",
  "version": "1.0.0",
  "timestamp": "2024-11-25T10:00:00.000Z"
}
```

### `POST /predict`
Effectue une prédiction avec le modèle neuronal.

**Request Body:**
```json
{
  "features": [
    [0.25, 1.10, 0.775, 0.75]
  ],
  "trainingData": {
    "inputs": [[0.2, 1.0, 0.7, 0.7], [0.3, 1.1, 0.75, 0.72]],
    "outputs": [5.2, 6.8]
  },
  "modelConfig": {
    "layers": [8, 4],
    "epochs": 50,
    "learningRate": 0.01
  }
}
```

**Response:**
```json
{
  "predictions": [7.3],
  "modelInfo": {
    "trained": true,
    "accuracy": 0.89,
    "loss": 0.05
  }
}
```

### `GET /model/info`
Informations sur le modèle générique chargé.

### `POST /model/reset`
Réinitialise le modèle générique en mémoire.

## Utilisation locale (sans Docker)

```bash
cd tensorflow-service
npm install
npm start
```

Le service démarrera sur le port 8501.

## Utilisation avec Docker

```bash
# Build
docker build -t tensorflow-prediction-service .

# Run
docker run -p 8501:8501 tensorflow-prediction-service
```

## Intégration avec NestJS Backend

Le backend NestJS communique avec ce service via le client HTTP `tensorflow.client.ts`. Configuration dans `.env`:

```env
TF_SERVICE_URL=http://tf-service:8501
TF_SERVICE_TIMEOUT=5000
TF_SERVICE_ENABLED=true
```

## Fonctionnement

1. **Sans données d'entraînement**: Utilise un modèle générique avec poids aléatoires (peu précis mais fonctionnel)
2. **Avec données d'entraînement (>5 samples)**: Entraîne un modèle ad-hoc sur vos données historiques pour des prédictions personnalisées
3. **Fallback**: Si le service est indisponible, le backend retourne des prédictions neutres (0%)

## Coût

- **Gratuit**: Utilise TensorFlow.js open-source et images Docker officielles
- **Ressources**: ~200MB RAM, CPU minimal
- Compatible avec hébergement gratuit (Render, Railway, etc.)
