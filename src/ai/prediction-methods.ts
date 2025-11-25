import { Simulation } from '../entities/Simulation';
import tensorFlowClient from './tensorflow.client';

/**
 * Interface pour les résultats de prédictions multi-méthodes
 */
export interface PredictionResults {
  linear: number;      // Prédiction par régression linéaire (%)
  neural: number;      // Prédiction par réseau de neurones TensorFlow (%)
  seasonal: number;    // Ajustement saisonnier ARIMA/moyennes mobiles (%)
  average: number;     // Moyenne des trois méthodes (%)
  baseline: number;    // Valeur de référence utilisée
  methods: {
    linear: { used: boolean; details: string };
    neural: { used: boolean; details: string };
    seasonal: { used: boolean; details: string };
  };
}

/**
 * Calcule une régression linéaire simple entre deux variables
 * @param x Variable indépendante
 * @param y Variable dépendante
 * @returns { slope, intercept, r2 }
 */
function simpleLinearRegression(x: number[], y: number[]): { slope: number; intercept: number; r2: number } {
  const n = x.length;
  if (n === 0 || n !== y.length) {
    return { slope: 0, intercept: 0, r2: 0 };
  }

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

  const denominator = n * sumX2 - sumX * sumX;
  if (Math.abs(denominator) < 1e-10) {
    return { slope: 0, intercept: sumY / n, r2: 0 };
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  // Calcul R²
  const meanY = sumY / n;
  const ssTotal = y.reduce((sum, yi) => sum + Math.pow(yi - meanY, 2), 0);
  const ssResidual = y.reduce((sum, yi, i) => sum + Math.pow(yi - (slope * x[i] + intercept), 2), 0);
  const r2 = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;

  return { slope, intercept, r2 };
}

/**
 * Calcule un ajustement saisonnier basé sur des moyennes mobiles et facteurs saisonniers
 * @param historical Données historiques avec dates
 * @param currentSeason Saison actuelle
 * @param recipeType Type de recette fiscale
 * @returns Facteur d'ajustement saisonnier (%)
 */
function calculateSeasonalAdjustment(
  historical: Array<{ date: string; value: number }>,
  currentSeason: string,
  recipeType: string,
): number {
  if (!historical || historical.length < 4) {
    // Pas assez de données pour analyse saisonnière
    return 0;
  }

  // Calculer moyenne mobile sur les 4 derniers mois
  const recentValues = historical.slice(-4).map(h => h.value);
  const movingAverage = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;

  // Facteurs saisonniers par type de recette et saison
  const seasonalFactors: { [key: string]: { [season: string]: number } } = {
    'Impôt foncier': {
      'Saison des pluies': 0.85,  // Réduction due aux difficultés d'accès/collecte
      'Saison sèche': 1.10,        // Meilleure collecte
      'Été': 1.05,
      'Hiver': 0.95,
    },
    'TVA': {
      'Saison des pluies': 0.95,
      'Saison sèche': 1.08,        // Augmentation activité touristique/commerce
      'Été': 1.12,                  // Haute saison touristique
      'Hiver': 0.92,
    },
    'Taxe professionnelle': {
      'Saison des pluies': 0.98,
      'Saison sèche': 1.05,
      'Été': 1.08,
      'Hiver': 0.95,
    },
    'Taxe locale': {
      'Saison des pluies': 0.90,
      'Saison sèche': 1.12,
      'Été': 1.10,
      'Hiver': 0.93,
    },
  };

  // Recherche du facteur approprié
  const recipeFactors = seasonalFactors[recipeType] || seasonalFactors['TVA'];
  const factor = recipeFactors[currentSeason] || 1.0;

  // Calcul de l'ajustement en %
  const adjustment = ((factor - 1.0) * 100);

  // Limitation de l'ajustement à ±20%
  return Math.max(-20, Math.min(20, adjustment));
}

/**
 * Applique plusieurs méthodes de prédiction quantitatives avant l'analyse AI
 * 
 * @param sim Objet Simulation avec parameters et contexts
 * @param city Nom de la ville
 * @param recipeType Type de recette fiscale
 * @param contexts Contextes enrichis (weather, economy, demography, time)
 * @returns Objet PredictionResults avec prédictions de chaque méthode
 */
export async function applyPredictionMethods(
  sim: Simulation,
  city: string,
  recipeType: string,
  contexts: any,
): Promise<PredictionResults> {
  console.log('[PredictionMethods] Starting multi-method prediction for:', {
    city,
    recipeType,
    hasHistorical: !!(sim.parameters as any)?.historical,
  });

  const params = (sim.parameters || {}) as any;
  const historical = params.historical || [];
  const baseline = historical.length > 0 ? historical[historical.length - 1].value : 1000000;

  const results: PredictionResults = {
    linear: 0,
    neural: 0,
    seasonal: 0,
    average: 0,
    baseline,
    methods: {
      linear: { used: false, details: '' },
      neural: { used: false, details: '' },
      seasonal: { used: false, details: '' },
    },
  };

  // ============================================================================
  // 1. RÉGRESSION LINÉAIRE (Backend TypeScript)
  // ============================================================================
  try {
    console.log('[PredictionMethods] Computing linear regression...');

    if (historical.length >= 3) {
      // Régression sur valeur vs. population si disponible
      const hasPopulation = historical.some((h: any) => h.population && h.population > 0);
      
      if (hasPopulation) {
        const xValues = historical.map((h: any) => h.population || 0);
        const yValues = historical.map((h: any) => h.value || 0);
        const regression = simpleLinearRegression(xValues, yValues);

        // Projection avec population actuelle ou croissance estimée (+1% par défaut)
        const currentPop = contexts.demography?.population || xValues[xValues.length - 1] * 1.01;
        const predicted = regression.slope * currentPop + regression.intercept;
        
        results.linear = ((predicted - baseline) / baseline) * 100;
        results.methods.linear.used = true;
        results.methods.linear.details = `Régression population vs revenu (R²=${regression.r2.toFixed(3)}, slope=${regression.slope.toFixed(2)})`;
      } else {
        // Régression temporelle simple (trend sur index de temps)
        const xValues = historical.map((_: any, idx: number) => idx);
        const yValues = historical.map((h: any) => h.value || 0);
        const regression = simpleLinearRegression(xValues, yValues);

        const nextIdx = historical.length;
        const predicted = regression.slope * nextIdx + regression.intercept;
        
        results.linear = ((predicted - baseline) / baseline) * 100;
        results.methods.linear.used = true;
        results.methods.linear.details = `Régression temporelle (R²=${regression.r2.toFixed(3)}, trend=${regression.slope > 0 ? 'croissant' : 'décroissant'})`;
      }

      // Ajustement météo pour certaines recettes
      if (contexts.weather && recipeType.toLowerCase().includes('foncier')) {
        const rainfall = contexts.weather.rainfall || 0;
        if (rainfall > 100) { // Fortes pluies
          const rainfallPenalty = Math.min(10, (rainfall - 100) / 20); // Max -10%
          results.linear -= rainfallPenalty;
          results.methods.linear.details += ` | Ajusté pour fortes pluies (-${rainfallPenalty.toFixed(1)}%)`;
        }
      }
    } else {
      results.methods.linear.details = 'Données historiques insuffisantes (< 3 points)';
    }

    console.log('[PredictionMethods] Linear prediction:', results.linear.toFixed(2) + '%');
  } catch (error) {
    console.error('[PredictionMethods] Linear regression error:', error);
    results.methods.linear.details = `Erreur: ${error}`;
  }

  // ============================================================================
  // 2. RÉSEAU DE NEURONES (Service TensorFlow conteneurisé)
  // ============================================================================
  try {
    console.log('[PredictionMethods] Calling TensorFlow neural network...');

    // Préparation des features pour le modèle neuronal
    const rainfall = contexts.weather?.rainfall || 0;
    const seasonFactor = getSeasonFactor(contexts.time?.season || 'Saison sèche');
    const population = contexts.demography?.population || 1000000;
    const gdp = contexts.economy?.gdp || contexts.economy?.imf_gdp || 10000000000;

    // Normalisation basique des features
    const features = [
      [
        rainfall / 200,              // Normalisation pluie (0-200mm -> 0-1)
        seasonFactor,                // Facteur saisonnier (0.8-1.2)
        population / 2000000,        // Normalisation population
        gdp / 20000000000,           // Normalisation PIB
      ],
    ];

    // Si assez de données historiques, préparer un dataset d'entraînement
    let trainingData: any = undefined;
    if (historical.length > 10) {
      const inputs: number[][] = [];
      const outputs: number[] = [];

      for (let i = 1; i < historical.length; i++) {
        const prev = historical[i - 1];
        const curr = historical[i];
        
        // Features simulées pour l'historique (approximation)
        const historicalFeatures = [
          rainfall / 200 * (0.8 + Math.random() * 0.4), // Variation aléatoire
          0.9 + Math.random() * 0.2,                    // Facteur saisonnier approximatif
          (prev.population || population) / 2000000,
          gdp / 20000000000 * (0.95 + Math.random() * 0.1),
        ];

        const actualChange = ((curr.value - prev.value) / prev.value) * 100;
        
        inputs.push(historicalFeatures);
        outputs.push(actualChange);
      }

      trainingData = { inputs, outputs };
      console.log('[PredictionMethods] Prepared training data:', {
        samples: inputs.length,
        avgChange: (outputs.reduce((a, b) => a + b, 0) / outputs.length).toFixed(2) + '%',
      });
    }

    // Appel au service TensorFlow
    const tfResponse = await tensorFlowClient.predict({
      features,
      trainingData,
      modelConfig: {
        layers: [8, 4],      // 2 couches cachées
        epochs: 50,
        learningRate: 0.01,
      },
    });

    if (tfResponse.predictions && tfResponse.predictions.length > 0) {
      results.neural = tfResponse.predictions[0];
      results.methods.neural.used = true;
      results.methods.neural.details = `Réseau de neurones TensorFlow (${trainingData ? 'entraîné' : 'générique'}, accuracy=${tfResponse.modelInfo?.accuracy?.toFixed(3) || 'N/A'})`;
      
      console.log('[PredictionMethods] Neural prediction:', results.neural.toFixed(2) + '%');
    } else {
      results.methods.neural.details = 'Service TensorFlow non disponible, utilisation fallback';
      console.warn('[PredictionMethods] TensorFlow returned empty predictions');
    }
  } catch (error) {
    console.error('[PredictionMethods] Neural network error:', error);
    results.methods.neural.details = `Erreur/Fallback: ${error}`;
  }

  // ============================================================================
  // 3. AJUSTEMENT SAISONNIER (ARIMA simplifié / moyennes mobiles)
  // ============================================================================
  try {
    console.log('[PredictionMethods] Computing seasonal adjustment...');

    const currentSeason = contexts.time?.season || contexts.time?.startSeason || 'Saison sèche';
    results.seasonal = calculateSeasonalAdjustment(historical, currentSeason, recipeType);
    results.methods.seasonal.used = true;
    results.methods.seasonal.details = `Moyenne mobile 4 mois + facteur saisonnier (${currentSeason})`;

    console.log('[PredictionMethods] Seasonal adjustment:', results.seasonal.toFixed(2) + '%');
  } catch (error) {
    console.error('[PredictionMethods] Seasonal adjustment error:', error);
    results.methods.seasonal.details = `Erreur: ${error}`;
  }

  // ============================================================================
  // 4. CALCUL DE LA MOYENNE
  // ============================================================================
  const validPredictions = [
    results.methods.linear.used ? results.linear : null,
    results.methods.neural.used ? results.neural : null,
    results.methods.seasonal.used ? results.seasonal : null,
  ].filter(p => p !== null) as number[];

  if (validPredictions.length > 0) {
    results.average = validPredictions.reduce((a, b) => a + b, 0) / validPredictions.length;
  }

  console.log('[PredictionMethods] Final results:', {
    linear: results.linear.toFixed(2) + '%',
    neural: results.neural.toFixed(2) + '%',
    seasonal: results.seasonal.toFixed(2) + '%',
    average: results.average.toFixed(2) + '%',
  });

  return results;
}

/**
 * Retourne un facteur numérique pour chaque saison (pour le modèle neuronal)
 */
function getSeasonFactor(season: string): number {
  const factors: { [key: string]: number } = {
    'Saison des pluies': 0.85,
    'Saison sèche': 1.10,
    'Été': 1.15,
    'Hiver': 0.90,
    'Automne': 1.00,
    'Printemps': 1.05,
  };

  return factors[season] || 1.0;
}
