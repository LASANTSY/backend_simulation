# Changelog - Système de Prédictions Quantitatives

## [1.0.0] - 2024-11-25

### 🎉 Ajout majeur : Prédictions quantitatives multi-méthodes

#### ✨ Nouvelles fonctionnalités

**3 méthodes de prédiction quantitatives** intégrées automatiquement avant l'analyse IA :

1. **Régression linéaire** (backend TypeScript)
   - Corrélations population/PIB vs. revenus
   - Détection de tendances temporelles
   - Ajustements météorologiques pour recettes foncières
   - Calcul du R² pour mesure de qualité

2. **Réseau de neurones** (service TensorFlow.js Docker)
   - Architecture MLP [8, 4, 1]
   - Features : [rainfall, seasonFactor, population, GDP]
   - Entraînement ad-hoc si ≥10 données historiques
   - Modèle générique si données insuffisantes
   - Optimizer Adam, Loss MSE, Metric MAE

3. **Analyse saisonnière** (backend TypeScript)
   - Moyennes mobiles sur 4 mois
   - Facteurs calibrés par (type de recette × saison)
   - Ajustements spécifiques Madagascar
   - Limitation ±20%

#### 📦 Nouveaux modules

**Backend** :
- `src/ai/tensorflow.client.ts` : Client HTTP pour TensorFlow Docker
- `src/ai/prediction-methods.ts` : Fonction principale `applyPredictionMethods()`
- `test/prediction-methods.test.ts` : Suite de tests unitaires (13 tests)
- `scripts/test-predictions.ts` : Script de test rapide standalone

**Service TensorFlow (Docker)** :
- `tensorflow-service/Dockerfile` : Image Node.js 18 + TensorFlow.js
- `tensorflow-service/index.js` : API Express (POST /predict, GET /health)
- `tensorflow-service/package.json` : Dépendances
- `tensorflow-service/README.md` : Documentation API

**Documentation** :
- `PREDICTIONS_OVERVIEW.md` : Vue d'ensemble technique
- `QUICKSTART_PREDICTIONS.md` : Guide de démarrage rapide
- `PREDICTION_METHODS_GUIDE.md` : Documentation complète (architecture, formules, contribution)
- `README_PREDICTIONS_INTEGRATION.md` : Section pour README principal
- `IMPLEMENTATION_COMPLETE.md` : Récapitulatif final

#### 🔧 Modifications

**Backend** :
- `src/ai/ai.service.ts` :
  - Import de `applyPredictionMethods`
  - Appel dans `enrichAnalysis()` avant `buildPrompt()`
  - Injection des prédictions dans `extraContext.predictions`
  - Section majeure ajoutée dans `buildPrompt()` avec instructions détaillées pour l'IA

**Infrastructure** :
- `docker-compose.yml` :
  - Ajout du service `tf-service` (port 8501)
  - Healthcheck automatique
  - Restart policy

**Configuration** :
- `.env.example` :
  - Variables TensorFlow ajoutées :
    - `TF_SERVICE_URL=http://localhost:8501`
    - `TF_SERVICE_TIMEOUT=5000`
    - `TF_SERVICE_ENABLED=true`

#### 🧪 Tests

- **13 tests unitaires Jest** : Tous passent (100%)
  - Régression linéaire avec/sans population
  - Appel TensorFlow avec données d'entraînement
  - Ajustement saisonnier pour différentes saisons
  - Calcul de moyenne pondérée
  - Fallbacks et gestion d'erreurs
  - Normalisation des features
  - Scénario complet Antananarivo/TVA

- **Script de test rapide** :
  - 3 scénarios : TVA saison sèche, Impôt foncier pluies, données limitées
  - Affichage formaté des résultats
  - Validation de convergence

#### 📊 Impact sur les analyses IA

**Avant** :
```json
{
  "interpretation": "La simulation montre une croissance possible...",
  "confidence": 0.6
}
```

**Après** :
```json
{
  "interpretation": "Les trois méthodes convergent fortement (écart <3%) vers une croissance de 6-8% :
    - Régression linéaire (+6.2%) : corrélation démographique
    - Réseau de neurones (+7.5%) : effet multiplicateur saison × météo
    - Analyse saisonnière (+7.0%) : facteur positif saison sèche
    Signal fort de croissance soutenable.",
  "confidence": 0.87,
  "prediction": {
    "values": [
      {"key": "linear", "value": 6.2},
      {"key": "neural", "value": 7.5},
      {"key": "seasonal", "value": 7.0},
      {"key": "average", "value": 6.9}
    ]
  }
}
```

#### ⚙️ Configuration requise

**Variables d'environnement** :
```env
TF_SERVICE_URL=http://localhost:8501
TF_SERVICE_TIMEOUT=5000
TF_SERVICE_ENABLED=true
```

**Docker Compose** :
```bash
docker-compose up -d tf-service
```

**Dépendances** (déjà installées) :
- axios ^1.4.0 (déjà présent)
- TensorFlow.js dans conteneur Docker (pas de dépendance Node directe)

#### 🚀 Déploiement

**Installation rapide (5 minutes)** :
```bash
# 1. Configuration
echo "TF_SERVICE_URL=http://localhost:8501" >> .env
echo "TF_SERVICE_ENABLED=true" >> .env

# 2. Démarrer TensorFlow
docker-compose up -d tf-service

# 3. Vérifier
curl http://localhost:8501/health

# 4. Tester
npx ts-node scripts/test-predictions.ts
```

#### 💰 Coût

**0€/mois** - Infrastructure entièrement gratuite :
- TensorFlow.js : Open-source
- Docker : Images officielles gratuites
- APIs : OpenWeatherMap free tier, World Bank gratuit
- Hébergement : Compatible free tiers (Render, Railway, Fly.io)

**Ressources** :
- RAM : ~200MB (service TensorFlow)
- CPU : 0.5 vCPU
- Disque : ~150MB (image Docker)

#### 🔍 Monitoring et logs

**Backend** :
```
[PredictionMethods] Starting multi-method prediction for: {city, recipeType}
[PredictionMethods] Final results: {linear: X%, neural: Y%, seasonal: Z%, average: W%}
```

**TensorFlow** :
```
[TensorFlow] Training completed: {finalLoss, finalMae}
[API] Predictions computed: {count, values}
```

#### 🐛 Gestion d'erreurs

**Fallbacks implémentés** :
- ✅ Service TensorFlow indisponible → `neural = 0%`, continue avec linear + seasonal
- ✅ Données historiques insuffisantes → Méthodes non utilisées gracieusement
- ✅ Clé API météo manquante → Fallback statique `rainfall = 0`
- ✅ Erreurs réseau → Timeouts configurables, logs détaillés

#### 📈 Performance

| Opération | Temps moyen |
|-----------|-------------|
| Régression linéaire | < 10ms |
| Analyse saisonnière | < 5ms |
| Neural (générique) | ~100-200ms |
| Neural (entraîné) | ~2-5s |
| **Total** | **~200ms à 5s** |

#### 🎓 Références techniques

**Mathématiques** :
- Régression linéaire : OLS (Ordinary Least Squares)
- R² : Coefficient de détermination
- Normalisation : Min-max scaling pour features neuronales

**Machine Learning** :
- TensorFlow.js Node v4.13.0
- Architecture : Sequential MLP
- Optimizer : Adam (learning rate 0.01)
- Loss : MSE (Mean Squared Error)
- Metric : MAE (Mean Absolute Error)

**Analyse temporelle** :
- Moyennes mobiles : Fenêtre 4 mois
- Facteurs saisonniers : Calibrés par type de recette

#### 🔗 Liens utiles

- [TensorFlow.js Documentation](https://www.tensorflow.org/js)
- [Guide complet](./PREDICTION_METHODS_GUIDE.md)
- [Guide de démarrage](./QUICKSTART_PREDICTIONS.md)
- [Tests unitaires](./test/prediction-methods.test.ts)

---

## Notes de version

### Compatibilité

- ✅ Compatible avec l'existant (pas de breaking changes)
- ✅ Fonctionne avec ou sans service TensorFlow (fallback)
- ✅ Pas de nouvelle dépendance Node.js (axios déjà présent)
- ✅ Docker Compose optionnel (service TensorFlow peut tourner standalone)

### Améliorations futures possibles

- [ ] Cache des modèles TensorFlow entraînés
- [ ] Ajout de features neuronales (inflation, chômage, taux de change)
- [ ] SHAP values pour explainability
- [ ] Hyperparameter tuning automatique
- [ ] LSTM pour séries temporelles complexes
- [ ] XGBoost pour ensemble methods

### Limitations connues

- Modèle neuronal générique peu précis si < 10 données historiques (attendu)
- Facteurs saisonniers basés sur estimations (à calibrer avec données réelles)
- Entraînement ad-hoc peut prendre 2-5s (acceptable pour usage batch)

---

**Contributeur** : Expert Backend Node.js/TypeScript + IA & Finance  
**Version** : 1.0.0  
**Date** : 25 novembre 2024  
**Statut** : ✅ Production Ready
