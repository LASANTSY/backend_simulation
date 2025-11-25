import axios, { AxiosInstance } from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Client HTTP pour communiquer avec le service TensorFlow conteneurisé
 * Le service TensorFlow expose une API REST pour l'entraînement et l'inférence
 */

export interface TensorFlowPredictionRequest {
  features: number[][]; // Tableau de features: [[rainfall, seasonFactor, pop, gdp], ...]
  trainingData?: {
    inputs: number[][];  // Features d'entraînement
    outputs: number[];   // Valeurs cibles (ajustements en %)
  };
  modelConfig?: {
    layers?: number[];   // Configuration des couches [8, 4] par défaut
    epochs?: number;     // Nombre d'époques d'entraînement
    learningRate?: number;
  };
}

export interface TensorFlowPredictionResponse {
  predictions: number[]; // Ajustements prédits en %
  modelInfo?: {
    trained: boolean;
    accuracy?: number;
    loss?: number;
  };
}

export class TensorFlowClient {
  private client: AxiosInstance;
  private serviceUrl: string;
  private timeout: number;
  private enabled: boolean;

  constructor() {
    this.serviceUrl = process.env.TF_SERVICE_URL || 'http://localhost:8501';
    this.timeout = parseInt(process.env.TF_SERVICE_TIMEOUT || '5000', 10);
    this.enabled = process.env.TF_SERVICE_ENABLED !== 'false';

    this.client = axios.create({
      baseURL: this.serviceUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!this.enabled) {
      console.warn('[TensorFlowClient] Service disabled via TF_SERVICE_ENABLED=false');
    }
  }

  /**
   * Appelle le service TensorFlow pour obtenir une prédiction
   * @param request Configuration de la requête avec features et données d'entraînement optionnelles
   * @returns Prédictions sous forme d'ajustements en %
   */
  async predict(request: TensorFlowPredictionRequest): Promise<TensorFlowPredictionResponse> {
    if (!this.enabled) {
      console.warn('[TensorFlowClient] Service disabled, returning neutral prediction');
      return {
        predictions: request.features.map(() => 0),
        modelInfo: { trained: false },
      };
    }

    try {
      console.log('[TensorFlowClient] Calling TensorFlow service:', {
        url: `${this.serviceUrl}/predict`,
        featuresCount: request.features.length,
        hasTrainingData: !!request.trainingData,
      });

      const response = await this.client.post<TensorFlowPredictionResponse>('/predict', request);

      console.log('[TensorFlowClient] Prediction successful:', {
        predictionsCount: response.data.predictions?.length,
        trained: response.data.modelInfo?.trained,
      });

      return response.data;
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || String(error);
      const statusCode = error?.response?.status;

      console.error('[TensorFlowClient] Prediction failed:', {
        error: errorMessage,
        status: statusCode,
        url: this.serviceUrl,
      });

      // En cas d'erreur, retourner des prédictions neutres (0% d'ajustement)
      // plutôt que de faire échouer toute l'analyse
      return {
        predictions: request.features.map(() => 0),
        modelInfo: {
          trained: false,
          accuracy: 0,
        },
      };
    }
  }

  /**
   * Vérifie si le service TensorFlow est disponible
   * @returns true si le service répond, false sinon
   */
  async healthCheck(): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    try {
      const response = await this.client.get('/health', { timeout: 2000 });
      return response.status === 200;
    } catch (error) {
      console.warn('[TensorFlowClient] Health check failed:', error);
      return false;
    }
  }

  /**
   * Retourne l'état de disponibilité du service
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Retourne l'URL du service configurée
   */
  getServiceUrl(): string {
    return this.serviceUrl;
  }
}

// Instance singleton exportée
export default new TensorFlowClient();
