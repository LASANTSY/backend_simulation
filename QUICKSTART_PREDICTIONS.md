# 🚀 Démarrage Rapide - Système de Prédictions Quantitatives

## Installation en 5 minutes

### Prérequis
- Node.js ≥ 18
- Docker et Docker Compose
- npm ou yarn

### 1️⃣ Configuration des variables d'environnement

Ajouter ces lignes à votre fichier `.env` :

```env
# Service TensorFlow pour prédictions neuronales
TF_SERVICE_URL=http://localhost:8501
TF_SERVICE_TIMEOUT=5000
TF_SERVICE_ENABLED=true
```

Si vous utilisez Docker Compose et que le backend est aussi conteneurisé, utilisez :
```env
TF_SERVICE_URL=http://tf-service:8501
```

### 2️⃣ Démarrer le service TensorFlow

**Avec Docker Compose (recommandé)** :
```bash
docker-compose up -d tf-service
```

**Sans Docker (développement)** :
```bash
cd tensorflow-service
npm install
npm start
```

### 3️⃣ Vérifier que tout fonctionne

```bash
# Health check du service TensorFlow
curl http://localhost:8501/health

# Réponse attendue :
# {"status":"healthy","service":"tensorflow-prediction","version":"1.0.0"}
```

### 4️⃣ Installer les dépendances du backend

```bash
npm install
```

### 5️⃣ Lancer un test rapide

```bash
# Test des prédictions (sans base de données)
npx ts-node scripts/test-predictions.ts

# Tests unitaires complets
npm test -- prediction-methods.test.ts
```

### 6️⃣ Démarrer le backend

```bash
npm run start:dev
```

---

## 📊 Utilisation via API

### Analyser une simulation

```http
POST /api/analysis/:analysisId/enrich
```

Le système appliquera automatiquement les 3 méthodes de prédiction avant d'envoyer le prompt à l'IA.

### Exemple de réponse

```json
{
  "aiAnalysis": {
    "prediction": {
      "summary": "Croissance attendue de 6.9% basée sur convergence des 3 méthodes quantitatives",
      "values": [
        {"key": "linear", "value": 6.2, "horizon": "Régression linéaire"},
        {"key": "neural", "value": 7.5, "horizon": "Réseau de neurones"},
        {"key": "seasonal", "value": 7.0, "horizon": "Analyse saisonnière"},
        {"key": "average", "value": 6.9, "horizon": "Moyenne pondérée"}
      ]
    },
    "interpretation": "Les trois méthodes convergent fortement (écart <3%) vers une prévision de croissance de 6-8% pour la TVA à Antananarivo en saison sèche...",
    "confidence": 0.87,
    "risks": [
      {
        "description": "Risque de divergence entre modèles en cas de changement climatique brutal",
        "probability": 0.15,
        "impact": "medium"
      }
    ]
  }
}
```

---

## 🧪 Tests disponibles

### Tests unitaires

```bash
# Tous les tests de prédiction
npm test -- prediction-methods.test.ts

# Avec couverture
npm test -- --coverage prediction-methods.test.ts

# Mode watch
npm test -- --watch prediction-methods.test.ts
```

### Tests d'intégration

```bash
# Test complet du workflow
npx ts-node scripts/test-predictions.ts
```

### Test manuel du service TensorFlow

```bash
curl -X POST http://localhost:8501/predict \
  -H "Content-Type: application/json" \
  -d '{
    "features": [[0.25, 1.10, 0.775, 0.75]],
    "modelConfig": {
      "layers": [8, 4],
      "epochs": 50
    }
  }'
```

---

## 🔧 Dépannage

### Le service TensorFlow ne démarre pas

**Vérifier les logs** :
```bash
docker logs tensorflow-prediction-service
```

**Redémarrer** :
```bash
docker-compose restart tf-service
```

**Vérifier le port** :
```bash
netstat -an | findstr "8501"
# Ou sur Linux/Mac : lsof -i :8501
```

### Le backend ne trouve pas le service TensorFlow

**Vérifier la configuration** :
```bash
# Afficher la valeur de TF_SERVICE_URL
echo %TF_SERVICE_URL%  # Windows
echo $TF_SERVICE_URL   # Linux/Mac
```

**Tester la connectivité** :
```bash
curl http://localhost:8501/health
```

**Solution temporaire** : Désactiver le service TensorFlow
```env
TF_SERVICE_ENABLED=false
```
Le système continuera de fonctionner avec les méthodes linéaire et saisonnière uniquement.

### Les prédictions sont toujours à 0%

**Vérifier que les données historiques sont présentes** :
```typescript
simulation.parameters.historical = [
  {date: '2024-01', value: 1000000, population: 1500000},
  // ... au moins 3-5 entrées pour résultats significatifs
]
```

**Vérifier les logs** :
```
[PredictionMethods] Starting multi-method prediction
[PredictionMethods] Linear prediction: X.XX%
[PredictionMethods] Neural prediction: X.XX%
```

---

## 📖 Documentation complète

- **[PREDICTION_METHODS_GUIDE.md](./PREDICTION_METHODS_GUIDE.md)** : Architecture détaillée, formules mathématiques, cas d'usage
- **[tensorflow-service/README.md](./tensorflow-service/README.md)** : Documentation du service TensorFlow
- **[test/prediction-methods.test.ts](./test/prediction-methods.test.ts)** : Exemples de tests et d'utilisation

---

## 🎯 Exemples de scénarios

### Scénario 1 : TVA en haute saison touristique

```typescript
{
  city: 'Nosy Be',
  recipeType: 'TVA',
  historical: [...12 mois de données...],
  contexts: {
    time: {season: 'Été'},  // Haute saison
    weather: {rainfall: 30}, // Peu de pluie
  }
}

// Résultat attendu : Prédictions positives (8-12%)
```

### Scénario 2 : Impôt foncier en saison des pluies

```typescript
{
  city: 'Manakara',
  recipeType: 'Impôt foncier',
  contexts: {
    time: {season: 'Saison des pluies'},
    weather: {rainfall: 200},  // Fortes pluies
  }
}

// Résultat attendu : Prédictions négatives (-10% à -15%)
// Pénalité appliquée pour difficultés de collecte
```

### Scénario 3 : Taxe professionnelle avec croissance économique

```typescript
{
  city: 'Antananarivo',
  recipeType: 'Taxe professionnelle',
  historical: [...tendance croissante...],
  contexts: {
    economy: {gdp: 16000000000, growth: 5.5},
    demography: {population: 1650000},
  }
}

// Résultat attendu : Prédictions positives (4-7%)
// Régression linéaire capte la corrélation PIB/recettes
```

---

## 🔍 Monitoring en production

### Logs à surveiller

**Backend** :
```
[PredictionMethods] Final results: {linear: X%, neural: Y%, seasonal: Z%, average: W%}
```

**TensorFlow** :
```
[TensorFlow] Training completed: {finalLoss: X, finalMae: Y}
[API] Predictions computed: {count: N, values: [...]}
```

### Métriques importantes

- **Convergence des méthodes** : Écart entre min et max des 3 prédictions
  - < 5% : Signal fort
  - 5-10% : Signal modéré
  - > 10% : Signal divergent (analyser les causes)

- **Utilisation des méthodes** :
  - Toutes utilisées : Données suffisantes ✅
  - Certaines manquantes : Vérifier la qualité des données

- **Disponibilité du service TensorFlow** :
  - Health check doit retourner 200
  - Temps de réponse < 2s pour prédiction simple
  - Temps de réponse < 10s pour entraînement ad-hoc

---

## 💡 Conseils d'optimisation

### Pour de meilleures prédictions

1. **Fournir au moins 12 mois de données historiques**
   - Permet l'entraînement ad-hoc du réseau de neurones
   - Améliore la détection des tendances saisonnières

2. **Inclure la population dans les données historiques**
   - Permet la régression population vs. revenu (plus précise)

3. **Fournir tous les contextes disponibles**
   - Météo, économie, démographie, saison
   - L'IA peut mieux interpréter les prédictions

4. **Calibrer les facteurs saisonniers**
   - Ajuster les valeurs dans `prediction-methods.ts`
   - Basé sur vos données historiques réelles

### Pour de meilleures performances

1. **Cache du modèle TensorFlow**
   - Implémenter la sauvegarde des modèles entraînés
   - Réutiliser pour simulations similaires

2. **Batch predictions**
   - Grouper plusieurs prédictions en une seule requête
   - Réduire la latence réseau

3. **Parallélisation**
   - Les 3 méthodes sont indépendantes
   - Potentiel pour exécution parallèle (future amélioration)

---

## 🆘 Support

**Problèmes connus** :

1. **TensorFlow.js sur Windows** : Peut nécessiter Python 3 et Visual Studio Build Tools
   - Solution : Utiliser Docker (recommandé)

2. **Port 8501 déjà utilisé** : Conflit avec un autre service
   - Solution : Changer le port dans `docker-compose.yml` et `.env`

3. **Prédictions neural toujours à 0%** : Service TensorFlow indisponible
   - Solution : Vérifier `docker logs tensorflow-prediction-service`

**Pour plus d'aide** :
- Consultez les logs du backend : `[PredictionMethods]`
- Consultez les logs TensorFlow : `docker logs tensorflow-prediction-service`
- Vérifiez les tests unitaires : `npm test prediction-methods.test.ts`

---

**Version** : 1.0.0  
**Dernière mise à jour** : 25 novembre 2024
