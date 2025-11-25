import { applyPredictionMethods, PredictionResults } from '../src/ai/prediction-methods';
import { Simulation } from '../src/entities/Simulation';
import tensorFlowClient from '../src/ai/tensorflow.client';

// Mock du client TensorFlow
jest.mock('../src/ai/tensorflow.client');

describe('PredictionMethods', () => {
  let mockSimulation: Simulation;
  let mockContexts: any;

  beforeEach(() => {
    // Simulation mock pour Antananarivo/TVA
    mockSimulation = {
      id: 'test-sim-1',
      parameters: {
        city: 'Antananarivo',
        recipeType: 'TVA',
        historical: [
          { date: '2024-01', value: 1000000, population: 1500000 },
          { date: '2024-02', value: 1050000, population: 1510000 },
          { date: '2024-03', value: 1100000, population: 1520000 },
          { date: '2024-04', value: 1150000, population: 1530000 },
          { date: '2024-05', value: 1200000, population: 1540000 },
        ],
      },
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Simulation;

    mockContexts = {
      time: {
        season: 'Saison sèche',
        startDate: '2024-06-01',
        endDate: '2024-06-30',
      },
      weather: {
        rainfall: 50,
        temperature: 22,
      },
      economy: {
        gdp: 15000000000,
        imf_gdp: 15000000000,
      },
      demography: {
        population: 1550000,
      },
    };

    // Mock du service TensorFlow
    (tensorFlowClient.predict as jest.Mock).mockResolvedValue({
      predictions: [8.5],
      modelInfo: {
        trained: true,
        accuracy: 0.89,
        loss: 0.05,
      },
    });

    (tensorFlowClient.isEnabled as jest.Mock).mockReturnValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('applyPredictionMethods', () => {
    it('should compute linear regression prediction based on population', async () => {
      const results = await applyPredictionMethods(
        mockSimulation,
        'Antananarivo',
        'TVA',
        mockContexts
      );

      expect(results.methods.linear.used).toBe(true);
      expect(results.linear).toBeGreaterThan(0); // Devrait prédire une augmentation
      expect(results.methods.linear.details).toContain('population');
    });

    it('should call TensorFlow service for neural prediction', async () => {
      const results = await applyPredictionMethods(
        mockSimulation,
        'Antananarivo',
        'TVA',
        mockContexts
      );

      expect(tensorFlowClient.predict).toHaveBeenCalledWith(
        expect.objectContaining({
          features: expect.arrayContaining([
            expect.arrayContaining([
              expect.any(Number), // rainfall normalized
              expect.any(Number), // seasonFactor
              expect.any(Number), // population normalized
              expect.any(Number), // gdp normalized
            ]),
          ]),
        })
      );

      expect(results.methods.neural.used).toBe(true);
      expect(results.neural).toBe(8.5);
      expect(results.methods.neural.details).toContain('TensorFlow');
    });

    it('should compute seasonal adjustment for TVA in dry season', async () => {
      const results = await applyPredictionMethods(
        mockSimulation,
        'Antananarivo',
        'TVA',
        mockContexts
      );

      expect(results.methods.seasonal.used).toBe(true);
      expect(results.seasonal).toBeGreaterThan(0); // Saison sèche = facteur positif pour TVA
      expect(results.methods.seasonal.details).toContain('Saison sèche');
    });

    it('should calculate average of all methods', async () => {
      const results = await applyPredictionMethods(
        mockSimulation,
        'Antananarivo',
        'TVA',
        mockContexts
      );

      const expectedAverage = (results.linear + results.neural + results.seasonal) / 3;
      expect(results.average).toBeCloseTo(expectedAverage, 2);
    });

    it('should handle TensorFlow service failure gracefully', async () => {
      (tensorFlowClient.predict as jest.Mock).mockRejectedValue(
        new Error('Service unavailable')
      );

      const results = await applyPredictionMethods(
        mockSimulation,
        'Antananarivo',
        'TVA',
        mockContexts
      );

      // Le service doit continuer avec les autres méthodes
      expect(results.methods.linear.used).toBe(true);
      expect(results.methods.seasonal.used).toBe(true);
      expect(results.neural).toBe(0); // Fallback
      expect(results.methods.neural.details).toContain('Erreur');
    });

    it('should apply rainfall penalty for "Impôt foncier" with heavy rain', async () => {
      mockSimulation.parameters.recipeType = 'Impôt foncier';
      mockContexts.weather.rainfall = 150; // Fortes pluies

      const results = await applyPredictionMethods(
        mockSimulation,
        'Antananarivo',
        'Impôt foncier',
        mockContexts
      );

      expect(results.methods.linear.details).toContain('fortes pluies');
      // La prédiction linéaire devrait être ajustée négativement
    });

    it('should handle insufficient historical data', async () => {
      mockSimulation.parameters.historical = [
        { date: '2024-01', value: 1000000 },
      ];

      const results = await applyPredictionMethods(
        mockSimulation,
        'Antananarivo',
        'TVA',
        mockContexts
      );

      expect(results.methods.linear.used).toBe(false);
      expect(results.methods.linear.details).toContain('insuffisantes');
    });

    it('should send training data to TensorFlow when sufficient history', async () => {
      // Ajouter plus de données historiques
      mockSimulation.parameters.historical = Array.from({ length: 12 }, (_, i) => ({
        date: `2024-${String(i + 1).padStart(2, '0')}`,
        value: 1000000 + i * 50000,
        population: 1500000 + i * 10000,
      }));

      await applyPredictionMethods(
        mockSimulation,
        'Antananarivo',
        'TVA',
        mockContexts
      );

      expect(tensorFlowClient.predict).toHaveBeenCalledWith(
        expect.objectContaining({
          trainingData: expect.objectContaining({
            inputs: expect.any(Array),
            outputs: expect.any(Array),
          }),
        })
      );
    });

    it('should compute correct seasonal factors for different seasons', async () => {
      // Test Saison des pluies
      mockContexts.time.season = 'Saison des pluies';
      const rainyResults = await applyPredictionMethods(
        mockSimulation,
        'Antananarivo',
        'TVA',
        mockContexts
      );

      // Test Été
      mockContexts.time.season = 'Été';
      const summerResults = await applyPredictionMethods(
        mockSimulation,
        'Antananarivo',
        'TVA',
        mockContexts
      );

      // L'été devrait donner un facteur plus élevé pour TVA (haute saison touristique)
      expect(summerResults.seasonal).toBeGreaterThan(rainyResults.seasonal);
    });
  });

  describe('Edge cases', () => {
    it('should handle missing contexts gracefully', async () => {
      const results = await applyPredictionMethods(
        mockSimulation,
        'Antananarivo',
        'TVA',
        {} // Contextes vides
      );

      expect(results).toBeDefined();
      expect(results.linear).toBeDefined();
      expect(results.neural).toBeDefined();
      expect(results.seasonal).toBeDefined();
      expect(results.average).toBeDefined();
    });

    it('should handle simulation without historical data', async () => {
      mockSimulation.parameters.historical = [];

      const results = await applyPredictionMethods(
        mockSimulation,
        'Antananarivo',
        'TVA',
        mockContexts
      );

      expect(results.baseline).toBe(1000000); // Valeur par défaut
      expect(results.methods.linear.used).toBe(false);
    });

    it('should normalize features correctly for neural network', async () => {
      await applyPredictionMethods(
        mockSimulation,
        'Antananarivo',
        'TVA',
        mockContexts
      );

      const callArgs = (tensorFlowClient.predict as jest.Mock).mock.calls[0][0];
      const features = callArgs.features[0];

      // Vérifier que les features sont normalisées (entre 0 et quelques unités)
      expect(features[0]).toBeGreaterThanOrEqual(0); // rainfall normalized
      expect(features[0]).toBeLessThanOrEqual(2);
      expect(features[1]).toBeGreaterThanOrEqual(0.5); // seasonFactor
      expect(features[1]).toBeLessThanOrEqual(1.5);
    });
  });

  describe('Integration scenario: Antananarivo TVA in dry season', () => {
    it('should produce realistic predictions for typical scenario', async () => {
      const results = await applyPredictionMethods(
        mockSimulation,
        'Antananarivo',
        'TVA',
        mockContexts
      );

      console.log('=== PREDICTION RESULTS ===');
      console.log('Linear:', results.linear.toFixed(2) + '%');
      console.log('Neural:', results.neural.toFixed(2) + '%');
      console.log('Seasonal:', results.seasonal.toFixed(2) + '%');
      console.log('Average:', results.average.toFixed(2) + '%');
      console.log('Baseline:', results.baseline.toLocaleString());
      console.log('=========================');

      // Vérifications de cohérence
      expect(results.average).toBeGreaterThan(0); // Tendance positive attendue
      expect(results.average).toBeLessThan(20); // Pas de prédiction irréaliste
      expect(Math.abs(results.average - results.linear)).toBeLessThan(15); // Cohérence
      expect(Math.abs(results.average - results.seasonal)).toBeLessThan(15);

      // Toutes les méthodes doivent être utilisées
      expect(results.methods.linear.used).toBe(true);
      expect(results.methods.neural.used).toBe(true);
      expect(results.methods.seasonal.used).toBe(true);
    });
  });
});
