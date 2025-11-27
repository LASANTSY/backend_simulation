# Guide d'Implémentation : Système de Prédictions Quantitatives Multi-Méthodes

## 📋 Vue d'ensemble

Ce guide documente l'implémentation d'un système de prédictions quantitatives qui combine **3 méthodes indépendantes** pour analyser les simulations de revenus fiscaux à Madagascar :

1. **Régression linéaire** (backend TypeScript)
2. **Réseau de neurones** (service TensorFlow.js conteneurisé)
3. **Analyse saisonnière** (ARIMA simplifié / moyennes mobiles)

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    NestJS Backend                           │
│                                                              │
│  ┌────────────────┐         ┌──────────────────┐           │
│  │  AIService     │────────▶│ prediction-      │           │
│  │  enrichAnalysis│         │ methods.ts       │           │
│  └────────────────┘         └──────────────────┘           │
│         │                            │                      │
│         │                            ├─────────────┐        │
│         │                            │             │        │
│         │                    ┌───────▼──────┐ ┌───▼────┐   │
│         │                    │ Régression   │ │ Saison │   │
│         │                    │ Linéaire     │ │ ARIMA  │   │
│         │                    └──────────────┘ └────────┘   │
│         │                            │                      │
│         │                            │ HTTP                 │
│         │                    ┌───────▼────────────────┐    │
│         │                    │ tensorflow.client.ts   │    │
│         │                    └────────────────────────┘    │
└─────────────────────────────────┼───────────────────────────┘
                                  │
                                  │ HTTP REST
                                  │
┌─────────────────────────────────▼───────────────────────────┐
│          Docker Container: tf-service                       │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  TensorFlow.js Node API (Express)                    │  │
│  │  - POST /predict                                      │  │
│  │  - GET /health                                        │  │
│  │                                                        │  │
│  │  Modèle MLP [8, 4, 1]                                │  │
│  │  Input: [rainfall, seasonFactor, pop, GDP]           │  │
│  │  Output: Ajustement en %                             │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

## 📦 Fichiers créés/modifiés

### Nouveaux fichiers

1. **`src/ai/tensorflow.client.ts`** (159 lignes)
   - Client HTTP pour communiquer avec le service TensorFlow
   - Gestion des timeouts, erreurs, fallback
   - Configuration via variables d'environnement

2. **`src/ai/prediction-methods.ts`** (355 lignes)
   - Fonction principale `applyPredictionMethods()`
   - Régression linéaire (population vs. revenu, ou trend temporel)
   - Appel au service TensorFlow pour réseau de neurones
   - Calcul d'ajustement saisonnier avec facteurs calibrés
   - Gestion d'erreurs et fallbacks

3. **`test/prediction-methods.test.ts`** (271 lignes)
   - Tests unitaires complets avec mocks
   - Scénarios : Antananarivo/TVA, différentes saisons
   - Tests de fallback et edge cases

4. **`tensorflow-service/`** (service Docker complet)
   - `Dockerfile` : Image Node.js 18 + TensorFlow.js
   - `package.json` : Dépendances (@tensorflow/tfjs-node, express, cors)
   - `index.js` : API Express avec endpoints /predict, /health
   - `README.md` : Documentation du service

### Fichiers modifiés

5. **`src/ai/ai.service.ts`**
   - Import de `applyPredictionMethods`
   - Appel dans `enrichAnalysis()` avant `buildPrompt()`
   - Injection des résultats dans `extraContext.predictions`
   - **Section majeure ajoutée dans `buildPrompt()`** : Instructions détaillées pour l'IA sur l'interprétation des prédictions quantitatives

6. **`docker-compose.yml`**
   - Ajout du service `tf-service` sur port 8501
   - Healthcheck automatique

7. **`.env.example`**
   - Variables `TF_SERVICE_URL`, `TF_SERVICE_TIMEOUT`, `TF_SERVICE_ENABLED`

## 🔧 Détails d'implémentation

### 1. Régression linéaire

**Méthode** : Moindres carrés ordinaires (OLS)

**Cas 1 : Population disponible**
```typescript
y = slope * population + intercept
```
- Régression `revenue = f(population)`
- Projection avec population actuelle ou croissance estimée (+1%)

**Cas 2 : Pas de population**
```typescript
y = slope * timeIndex + intercept
```
- Régression temporelle simple
- Détecte la tendance (croissante/décroissante)

**Ajustement météo** : Pour les recettes foncières rurales, pénalité si fortes pluies (>100mm)
```typescript
if (rainfall > 100 && recipeType.includes('foncier')) {
  linear -= min(10%, (rainfall - 100) / 20)
}
```

**R²** : Calculé et inclus dans les détails de la méthode

### 2. Réseau de neurones (TensorFlow)

**Architecture** :
```
Input (4)  →  Dense(8, relu)  →  Dropout(0.2)  →  Dense(4, relu)  →  Dense(1, linear)
```

**Features (normalisées)** :
1. `rainfall / 200` (0-200mm → 0-1)
2. `seasonFactor` (0.85-1.15 selon saison)
3. `population / 2,000,000`
4. `GDP / 20,000,000,000`

**Modes** :

**A) Modèle générique** (< 10 données historiques)
- Poids aléatoires initialisés
- Peu précis mais fonctionnel
- Retourné instantanément

**B) Modèle entraîné** (≥ 10 données historiques)
- Dataset construit à partir de `historical`
- Entraînement sur 50 epochs avec validation split 20%
- Optimizer : Adam (lr=0.01)
- Loss : MSE, Metric : MAE
- Accuracy approximée : `1 - MAE/10`

**Fallback** : Si service indisponible → retour `0%` avec log d'erreur

### 3. Analyse saisonnière

**Méthode** : Moyenne mobile 4 mois + facteur saisonnier calibré

**Facteurs par type de recette** :

| Saison            | Impôt foncier | TVA  | Taxe pro | Taxe locale |
|-------------------|---------------|------|----------|-------------|
| Saison des pluies | 0.85          | 0.95 | 0.98     | 0.90        |
| Saison sèche      | 1.10          | 1.08 | 1.05     | 1.12        |
| Été               | 1.05          | 1.12 | 1.08     | 1.10        |
| Hiver             | 0.95          | 0.92 | 0.95     | 0.93        |

**Formule** :
```typescript
adjustment = ((seasonFactor - 1.0) * 100)
// Limité à ±20%
```

### 4. Calcul de la moyenne

```typescript
average = (linear + neural + seasonal) / countUsedMethods
```

Seules les méthodes qui ont été utilisées avec succès sont incluses dans la moyenne.

## 📊 Format de sortie

```typescript
interface PredictionResults {
  linear: number;      // Ex: 5.2%
  neural: number;      // Ex: 8.5%
  seasonal: number;    // Ex: 7.0%
  average: number;     // Ex: 6.9%
  baseline: number;    // Ex: 1200000 MGA
  methods: {
    linear: { used: boolean; details: string };
    neural: { used: boolean; details: string };
    seasonal: { used: boolean; details: string };
  };
}
```

## 🤖 Intégration dans le prompt AI

Une **section majeure** a été ajoutée dans `buildPrompt()` qui guide l'IA sur l'interprétation des prédictions :

### Instructions pour l'IA

**a) Convergence/Divergence**
- Si ±5% → Signal fort, confiance > 0.8
- Si >10% d'écart → Expliquer pourquoi chaque méthode diverge

**b) Cohérence avec contextes**
- Météo : Le neural a-t-il capté l'impact pluie/température ?
- Saison : L'ajustement reflète-t-il la haute/basse saison ?
- Économie : La régression PIB/population est-elle soutenable ?

**c) Risques et opportunités**
- Écarts = risques potentiels
- Ex : Neural +15%, Seasonal +5% → risque de sur-optimisme

**d) Justification des scénarios**
- Optimiste : Max des 3 méthodes
- Moyen : Average
- Pessimiste : Min + marge de sécurité

### Exemple d'analyse attendue de l'IA

```
"Les trois méthodes convergent fortement (écart <3%) vers une prévision 
de croissance de 6-8% pour la TVA à Antananarivo en saison sèche :

- La régression linéaire (+6.2%) capte la corrélation historique entre 
  croissance démographique et recettes TVA.
  
- Le réseau de neurones (+7.5%) détecte un effet multiplicateur lié à 
  l'interaction entre saison sèche (haute saison touristique) et faible 
  pluviométrie, favorable au commerce.
  
- L'analyse saisonnière (+7.0%) confirme le facteur saisonnier positif 
  typique de l'été à Madagascar pour les taxes de consommation.

Confiance élevée (0.85) compte tenu de la convergence des signaux 
quantitatifs et de la qualité des données contextuelles."
```

## 🚀 Déploiement

### 1. Configuration locale

```bash
# Copier .env.example vers .env
cp .env.example .env

# Éditer les variables TensorFlow
TF_SERVICE_URL=http://localhost:8501
TF_SERVICE_TIMEOUT=5000
TF_SERVICE_ENABLED=true
```

### 2. Démarrer le service TensorFlow

**Option A : Docker Compose (recommandé)**
```bash
docker-compose up -d tf-service
```

**Option B : Build manuel**
```bash
cd tensorflow-service
docker build -t tensorflow-prediction-service .
docker run -p 8501:8501 tensorflow-prediction-service
```

**Option C : Sans Docker (développement)**
```bash
cd tensorflow-service
npm install
npm start
```

### 3. Vérifier le service

```bash
# Health check
curl http://localhost:8501/health

# Test de prédiction
curl -X POST http://localhost:8501/predict \
  -H "Content-Type: application/json" \
  -d '{
    "features": [[0.25, 1.10, 0.775, 0.75]]
  }'
```

### 4. Démarrer le backend NestJS

```bash
npm install
npm run start:dev
```

## 🧪 Tests

```bash
# Lancer les tests unitaires
npm test -- prediction-methods.test.ts

# Avec couverture
npm test -- --coverage prediction-methods.test.ts
```

**Tests inclus** :
- ✅ Régression linéaire avec/sans population
- ✅ Appel TensorFlow avec données d'entraînement
- ✅ Ajustement saisonnier pour différentes saisons
- ✅ Calcul de la moyenne
- ✅ Fallback si TensorFlow indisponible
- ✅ Pénalité pluie pour foncier
- ✅ Gestion de données insuffisantes
- ✅ Normalisation des features
- ✅ Scénario complet Antananarivo/TVA

## 🔍 Logs et monitoring

### Logs du backend

```
[PredictionMethods] Starting multi-method prediction for: {city, recipeType}
[PredictionMethods] Computing linear regression...
[PredictionMethods] Linear prediction: 6.20%
[TensorFlowClient] Calling TensorFlow service: {url, featuresCount, hasTrainingData}
[TensorFlowClient] Prediction successful: {predictionsCount, trained}
[PredictionMethods] Neural prediction: 7.50%
[PredictionMethods] Computing seasonal adjustment...
[PredictionMethods] Seasonal adjustment: 7.00%
[PredictionMethods] Final results: {linear, neural, seasonal, average}
```

### Logs du service TensorFlow

```
[TensorFlow] Training model with: {samples, features, layers, epochs}
[TensorFlow] Epoch 0/50 - loss: 0.1234, mae: 0.0567
[TensorFlow] Epoch 10/50 - loss: 0.0891, mae: 0.0432
[TensorFlow] Training completed: {finalLoss, finalMae}
[API] Predictions computed: {count, values}
```

## ⚠️ Gestion des erreurs

### 1. Service TensorFlow indisponible

**Comportement** :
- Log warning
- `neural = 0%` (neutre)
- Continue avec linear + seasonal
- Ne bloque pas l'analyse AI

**Vérification** :
```typescript
if (!tensorFlowClient.isEnabled()) {
  console.warn('[TensorFlowClient] Service disabled');
  return { predictions: [0], modelInfo: { trained: false } };
}
```

### 2. Données historiques insuffisantes

**Comportement** :
- Linear non utilisé si < 3 points
- Seasonal non utilisé si < 4 points
- Neural utilise modèle générique si < 10 points

### 3. Clé API météo manquante

**Comportement** (déjà géré dans context.service) :
- Fallback statique : `weather = { rainfall: 0 }`
- Log warning
- Continue avec contextes disponibles

## 💰 Coûts et infrastructure

### Totalement gratuit (0€/mois)

- **TensorFlow.js** : Open-source, pas de service cloud payant
- **Docker** : Images officielles gratuites
- **APIs publiques** : OpenWeatherMap (free tier), World Bank (gratuit), INSTAT (public)
- **Hébergement** : Compatible Render, Railway, Fly.io (free tiers)

### Ressources requises

**Service TensorFlow** :
- RAM : ~200MB
- CPU : 0.5 vCPU (léger)
- Disque : ~150MB (image Docker)

**Backend NestJS** :
- Pas de dépendance TensorFlow (déporté dans conteneur)
- Impact minimal sur bundle size

## 🎯 Cas d'usage

### Exemple 1 : TVA Antananarivo, Saison sèche

**Input** :
```typescript
{
  city: 'Antananarivo',
  recipeType: 'TVA',
  historical: [
    {date: '2024-01', value: 1000000, population: 1500000},
    // ... 10 autres mois
  ]
}

contexts: {
  weather: {rainfall: 50, temperature: 22},
  time: {season: 'Saison sèche'},
  economy: {gdp: 15000000000},
  demography: {population: 1550000}
}
```

**Output** :
```typescript
{
  linear: 6.2,    // Trend population
  neural: 7.5,    // Apprentissage interactions
  seasonal: 7.0,  // Facteur saison sèche
  average: 6.9,
  baseline: 1200000
}
```

**Analyse AI (exemple)** :
> "Convergence forte des 3 méthodes (6.2-7.5%) suggérant une croissance 
> soutenue de la TVA. Le réseau de neurones détecte un effet multiplicateur 
> saison sèche + démographie favorable. Confiance : 0.87"

### Exemple 2 : Impôt foncier rural, Saison des pluies

**Input** :
```typescript
{
  city: 'Toamasina',
  recipeType: 'Impôt foncier',
  historical: [...],
  contexts: {
    weather: {rainfall: 180},  // Fortes pluies
    time: {season: 'Saison des pluies'}
  }
}
```

**Output** :
```typescript
{
  linear: 2.5,    // Pénalité pluie appliquée (-4%)
  neural: 1.2,    // Neural détecte impact négatif
  seasonal: -15.0, // Facteur 0.85 pour foncier
  average: -3.8
}
```

**Analyse AI (exemple)** :
> "Divergence significative entre linear (+2.5%) et seasonal (-15%) reflète 
> l'incertitude liée aux fortes précipitations. Le neural (+1.2%) suggère un 
> impact modéré. Recommandation : scénario prudent à -10%."

## 📚 Références techniques

**Régression linéaire** :
- OLS (Ordinary Least Squares)
- Calcul R² pour mesure de qualité

**TensorFlow.js** :
- [Documentation officielle](https://www.tensorflow.org/js)
- Layers API : Sequential, Dense, Dropout
- Optimizer : Adam
- Loss : MSE (Mean Squared Error)

**Analyse saisonnière** :
- Inspiré de ARIMA mais simplifié (pas d'AR/MA complet)
- Moyennes mobiles + facteurs saisonniers calibrés
- Facteurs basés sur données historiques Madagascar

## 🤝 Contribution et maintenance

### Points d'extension possibles

1. **Améliorer les facteurs saisonniers** : Calibrer avec plus de données historiques réelles
2. **Ajouter d'autres méthodes** : LSTM pour séries temporelles, XGBoost pour ensembles
3. **Hyperparamètres tunables** : Permettre ajustement layers, epochs via config
4. **Cache des modèles** : Sauvegarder les modèles entraînés pour réutilisation
5. **Explainability** : SHAP values pour expliquer les prédictions neurales

### Tests de non-régression

Ajouter ces tests lors de modifications :
- Vérifier que l'average reste dans ±30% de la baseline
- Vérifier que les 3 méthodes sont appelées si données suffisantes
- Vérifier que le fallback fonctionne si TensorFlow down

## 📞 Support

Pour questions ou bugs :
1. Vérifier les logs du backend (`[PredictionMethods]`)
2. Vérifier les logs TensorFlow (`docker logs tensorflow-prediction-service`)
3. Tester le service isolément : `curl http://localhost:8501/health`
4. Vérifier les variables d'environnement `.env`

---

**Version** : 1.0.0  
**Date** : 25 novembre 2024  
**Auteur** : Expert Backend Node.js/TypeScript + IA & Finance
