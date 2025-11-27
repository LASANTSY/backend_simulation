# ⚠️ Points d'Attention - Système de Prédictions Quantitatives

## 🔍 Checklist avant mise en production

### Configuration

- [ ] **Variables d'environnement** définies dans `.env` :
  ```env
  TF_SERVICE_URL=http://localhost:8501  # ou http://tf-service:8501 si backend Docker
  TF_SERVICE_TIMEOUT=5000
  TF_SERVICE_ENABLED=true
  ```

- [ ] **Service TensorFlow** démarré et accessible :
  ```bash
  docker-compose up -d tf-service
  curl http://localhost:8501/health  # Doit retourner 200
  ```

- [ ] **Tests unitaires** passent :
  ```bash
  npm test prediction-methods.test.ts  # 13/13 tests doivent passer
  ```

### Données d'entrée

- [ ] **Données historiques** présentes dans `simulation.parameters.historical[]`
  - Minimum : **3 points** pour régression linéaire
  - Optimal : **≥10 points** pour entraînement neural ad-hoc
  - Format : `{date: string, value: number, population?: number}`

- [ ] **Contextes** fournis dans `extraContext` :
  - `weather` : `{rainfall, temperature}` (optionnel, fallback si absent)
  - `economy` : `{gdp, imf_gdp}` (optionnel)
  - `demography` : `{population}` (optionnel mais recommandé)
  - `time` : `{season, startDate}` (optionnel mais recommandé)

### Monitoring

- [ ] **Logs backend** surveillés :
  - `[PredictionMethods]` : Résultats des prédictions
  - `[TensorFlowClient]` : État des appels au service
  - `[AI enrichAnalysis]` : Prédictions injectées dans le prompt

- [ ] **Logs TensorFlow** surveillés :
  ```bash
  docker-compose logs -f tf-service
  ```
  - `[TensorFlow] Training completed` : Entraînement réussi
  - `[API] Predictions computed` : Prédictions générées

- [ ] **Health check** régulier :
  ```bash
  curl http://localhost:8501/health
  ```

---

## ⚠️ Limitations connues

### 1. Modèle neuronal générique peu précis

**Problème** : Si < 10 données historiques, le modèle TensorFlow utilise des poids aléatoires initiaux (peu précis).

**Impact** : Prédiction `neural` peut être aberrante ou non pertinente.

**Solution** :
- ✅ C'est **attendu** et **géré** : La moyenne inclut aussi `linear` et `seasonal`
- ✅ L'IA interprète les divergences et ajuste sa confiance
- 💡 Fournir ≥10 mois de données historiques pour entraînement ad-hoc

### 2. Facteurs saisonniers basés sur estimations

**Problème** : Les facteurs dans `calculateSeasonalAdjustment()` sont des estimations (ex: TVA saison sèche = 1.08).

**Impact** : Peut ne pas refléter la réalité locale spécifique.

**Solution** :
- 💡 Calibrer avec vos données réelles Madagascar
- 💡 Fichier à modifier : `src/ai/prediction-methods.ts` ligne 130-145
- 💡 Collecter statistiques mensuelles par type de recette et saison

### 3. Performance d'entraînement

**Problème** : Si ≥10 données + `trainingData` fourni, l'entraînement TensorFlow prend **2-5 secondes**.

**Impact** : Latence API augmentée.

**Solution** :
- ✅ Acceptable pour usage **batch** (analyses non temps-réel)
- ⚠️ Si temps-réel critique : Réduire `epochs` à 20-30 dans `modelConfig`
- 💡 Future : Implémenter cache des modèles entraînés

### 4. Service TensorFlow indisponible

**Problème** : Si Docker down ou réseau problématique, prédiction `neural = 0%`.

**Impact** : Perte d'une méthode de prédiction.

**Solution** :
- ✅ **Fallback automatique** déjà implémenté
- ✅ Le système continue avec `linear` + `seasonal`
- ✅ L'IA adapte son analyse et sa confiance
- 💡 Surveiller les logs `[TensorFlowClient] Prediction failed`

---

## 🚨 Cas d'erreur à gérer

### 1. Pas de données historiques

**Symptôme** : `simulation.parameters.historical = []` ou `undefined`

**Comportement** :
- `linear = 0%`, `methods.linear.used = false`
- `seasonal = 0%`, `methods.seasonal.used = false`
- `neural` peut fonctionner (modèle générique)

**Action** :
- ⚠️ Vérifier que les simulations incluent au moins 3-5 mois de données
- 💡 Enrichir les données historiques avant analyse

### 2. Service TensorFlow inaccessible

**Symptôme** : `ECONNREFUSED` dans les logs backend

**Comportement** :
- `neural = 0%`, `methods.neural.used = false`
- Log : `[TensorFlowClient] Prediction failed: ECONNREFUSED`

**Action** :
```bash
# Vérifier l'état
docker-compose ps tf-service

# Redémarrer si nécessaire
docker-compose restart tf-service

# Vérifier les logs
docker-compose logs tf-service

# Solution temporaire : Désactiver
# Dans .env :
TF_SERVICE_ENABLED=false
```

### 3. Timeout TensorFlow

**Symptôme** : `Request timeout` après 5 secondes

**Comportement** :
- `neural = 0%`, fallback automatique
- Log : `[TensorFlowClient] Prediction failed: timeout`

**Action** :
```bash
# Augmenter le timeout dans .env :
TF_SERVICE_TIMEOUT=10000  # 10 secondes

# Ou réduire les epochs d'entraînement
# Dans l'appel à tensorFlowClient.predict() :
modelConfig: { epochs: 20 }  # au lieu de 50
```

### 4. Prédictions divergentes (>15%)

**Symptôme** : `linear = 15%`, `neural = -5%`, `seasonal = 10%`

**Comportement** :
- `average` calculée normalement
- L'IA doit expliquer les écarts

**Action** :
- ✅ C'est une **feature**, pas un bug
- ✅ L'IA interprète les divergences dans son analyse
- 💡 Vérifier la qualité des contextes fournis
- 💡 Si récurrent : Calibrer les facteurs saisonniers

### 5. Clé API météo manquante

**Symptôme** : `process.env.OPENWEATHER_API_KEY` non défini

**Comportement** :
- `weather = { rainfall: 0 }` (fallback)
- Régression linéaire fonctionne quand même
- Neural utilise `rainfall = 0` (normalisé)

**Action** :
```bash
# Ajouter la clé dans .env :
OPENWEATHER_API_KEY=your_key_here

# Ou accepter le fallback (prédictions moins précises)
```

---

## 🔧 Maintenance recommandée

### Quotidienne

- [ ] **Health check** TensorFlow : `curl http://localhost:8501/health`
- [ ] **Vérifier logs** pour erreurs : `docker-compose logs --tail=50 tf-service`

### Hebdomadaire

- [ ] **Analyser convergence** des prédictions (écart moyen entre méthodes)
- [ ] **Vérifier performance** : Temps de réponse moyen < 5s

### Mensuelle

- [ ] **Calibrer facteurs saisonniers** avec données réelles collectées
- [ ] **Évaluer précision** des prédictions vs. réalité terrain
- [ ] **Mettre à jour documentation** si changements

### Trimestrielle

- [ ] **Audit de sécurité** : Dépendances npm/Docker à jour
- [ ] **Optimisation** : Tester nouvelles architectures neuronales
- [ ] **Backup** : Configuration et modèles entraînés (si cache implémenté)

---

## 💡 Optimisations futures

### Court terme (1-2 mois)

1. **Cache des modèles entraînés**
   - Sauvegarder les modèles TensorFlow entraînés
   - Réutiliser pour simulations similaires (même ville/type recette)
   - Impact : Réduction latence de 5s à 200ms

2. **Calibration saisonnière automatique**
   - Analyser historiques réels Madagascar
   - Ajuster facteurs dans `prediction-methods.ts`
   - Impact : Prédictions `seasonal` plus précises

3. **Monitoring Prometheus/Grafana**
   - Métriques : Temps de réponse, convergence, taux d'erreur
   - Alertes : Service TensorFlow down, divergence anormale
   - Impact : Détection proactive des problèmes

### Moyen terme (3-6 mois)

4. **Ajout de features neuronales**
   - Inflation, chômage, taux de change, indices économiques
   - Impact : Prédictions `neural` plus riches

5. **Modèles LSTM pour séries temporelles**
   - Remplacement MLP par LSTM pour capturer séquences
   - Impact : Meilleures prédictions sur tendances long-terme

6. **Explainability (SHAP values)**
   - Expliquer quelles features contribuent le plus
   - Impact : Transparence pour les décideurs

### Long terme (6-12 mois)

7. **Ensemble methods (XGBoost)**
   - Ajouter gradient boosting comme 4e méthode
   - Impact : Robustesse accrue

8. **Hyperparameter tuning automatique**
   - Optimiser layers, epochs, learning rate
   - Impact : Performances optimales

9. **API publique de prédictions**
   - Exposer endpoint `/api/predict` standalone
   - Impact : Réutilisable par d'autres services

---

## 📞 Contacts et support

### En cas de problème technique

1. **Consulter la documentation** :
   - [QUICKSTART](./QUICKSTART_PREDICTIONS.md) - Section Dépannage
   - [COMMANDS](./COMMANDS_CHEATSHEET.md) - Commandes de diagnostic

2. **Vérifier les logs** :
   ```bash
   # Backend
   # Chercher: [PredictionMethods], [TensorFlowClient]
   
   # TensorFlow
   docker-compose logs tf-service
   ```

3. **Tests de diagnostic** :
   ```bash
   # Test rapide complet
   npx ts-node scripts/test-predictions.ts
   
   # Tests unitaires
   npm test prediction-methods.test.ts
   ```

4. **Fallback temporaire** :
   ```bash
   # Désactiver TensorFlow si bloquant
   echo "TF_SERVICE_ENABLED=false" >> .env
   # Redémarrer backend
   ```

### Pour amélioration des prédictions

1. **Collecter données réelles** :
   - Historiques mensuels par ville et type de recette
   - Conditions météo moyennes par saison
   - Corrélations économiques observées

2. **Calibrer facteurs** :
   - Fichier : `src/ai/prediction-methods.ts`
   - Fonction : `calculateSeasonalAdjustment()`
   - Ajuster les facteurs dans l'objet `seasonalFactors`

3. **Tester et valider** :
   ```bash
   npm test prediction-methods.test.ts
   npx ts-node scripts/test-predictions.ts
   ```

---

## ✅ Validation finale

Avant de considérer le système prêt pour production :

- [ ] Tous les tests unitaires passent (13/13)
- [ ] Service TensorFlow démarre sans erreur
- [ ] Health check retourne 200
- [ ] Test rapide produit des prédictions cohérentes
- [ ] Logs backend ne montrent pas d'erreurs
- [ ] Logs TensorFlow ne montrent pas d'erreurs
- [ ] Documentation lue et comprise par l'équipe
- [ ] Plan de monitoring en place
- [ ] Backup de configuration effectué

---

**⚠️ Ce document doit être relu régulièrement par l'équipe de développement et de maintenance.**

**Version 1.0.0 (2024-11-25)**
