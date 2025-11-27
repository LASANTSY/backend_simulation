# 🎯 Système de Prédictions Quantitatives Multi-Méthodes

## Vue d'ensemble

Le système de prédictions quantitatives combine **3 méthodes statistiques et ML indépendantes** pour analyser les simulations de revenus fiscaux avant l'analyse qualitative par l'IA (OpenAI/Gemini).

### Les 3 Méthodes

| Méthode | Technique | Implémentation | Output |
|---------|-----------|----------------|--------|
| 🔢 **Régression Linéaire** | OLS (Ordinary Least Squares) | Backend TypeScript | Tendance basée sur population/PIB ou temps |
| 🧠 **Réseau de Neurones** | MLP 2 couches [8,4] | Service TensorFlow.js Docker | Apprentissage non-linéaire des interactions contextuelles |
| 📊 **Analyse Saisonnière** | Moyennes mobiles + facteurs | Backend TypeScript | Ajustement selon saison et type de recette |

### Architecture

```
Backend NestJS
    │
    ├─► Régression linéaire (local)
    │   └─ Corrélations population/PIB/temps
    │
    ├─► HTTP → TensorFlow Docker (port 8501)
    │   └─ Réseau neuronal [rainfall, season, pop, gdp] → ajustement %
    │
    └─► Analyse saisonnière (local)
        └─ Facteurs calibrés par type de recette
```

## 🚀 Démarrage en 3 commandes

```bash
# 1. Configurer l'environnement
echo "TF_SERVICE_URL=http://localhost:8501" >> .env
echo "TF_SERVICE_ENABLED=true" >> .env

# 2. Démarrer le service TensorFlow
docker-compose up -d tf-service

# 3. Tester
npx ts-node scripts/test-predictions.ts
```

## 📊 Exemple de résultat

```json
{
  "linear": 6.2,      // Régression linéaire (population vs. revenu)
  "neural": 7.5,      // Réseau de neurones (météo + saison + économie)
  "seasonal": 7.0,    // Ajustement saisonnier (Saison sèche pour TVA)
  "average": 6.9,     // Moyenne des 3 méthodes
  "baseline": 1200000 // Valeur de référence (dernier historique)
}
```

## 🤖 Impact sur l'analyse IA

Les prédictions quantitatives sont **automatiquement injectées** dans le prompt envoyé à OpenAI/Gemini avec des instructions détaillées sur l'interprétation :

### Avant (sans prédictions)
```
"Analysez cette simulation de revenus en tenant compte du contexte."
```

### Après (avec prédictions)
```
"PRÉDICTIONS QUANTITATIVES (3 MÉTHODES INDÉPENDANTES):

1. RÉGRESSION LINÉAIRE: 6.2%
   Régression population vs revenu (R²=0.923)
   
2. RÉSEAU DE NEURONES (TensorFlow): 7.5%
   MLP 2 couches [8,4], entraîné sur vos données historiques
   
3. ANALYSE SAISONNIÈRE: 7.0%
   Moyenne mobile 4 mois + facteur saisonnier (Saison sèche)

MOYENNE PONDÉRÉE: 6.9%

INSTRUCTIONS: Analysez la CONVERGENCE/DIVERGENCE des 3 signaux.
Si convergentes (±5%): Signal fort, haute confiance → confidence > 0.8
Si divergentes (>10%): Expliquer les écarts et identifier les risques..."
```

### Exemple d'analyse IA enrichie

> "Les trois méthodes convergent fortement (écart <3%) vers une prévision de croissance de 6-8% pour la TVA à Antananarivo en saison sèche :
>
> - La régression linéaire (+6.2%) capte la corrélation historique entre croissance démographique et recettes TVA
> - Le réseau de neurones (+7.5%) détecte un effet multiplicateur lié à l'interaction entre saison sèche (haute saison touristique) et faible pluviométrie, favorable au commerce
> - L'analyse saisonnière (+7.0%) confirme le facteur saisonnier positif typique de l'été à Madagascar
>
> **Confiance : 0.87** (convergence des signaux quantitatifs + qualité des données contextuelles)"

## 🎯 Cas d'usage typiques

### 1. TVA en haute saison (convergence positive)
```
Contexte : Nosy Be, Été, rainfall=30mm
Résultats : Linear +9%, Neural +11%, Seasonal +10% → Moyenne +10%
Analyse IA : Signal fort de croissance (haute saison touristique confirmée)
```

### 2. Impôt foncier en saison des pluies (convergence négative)
```
Contexte : Manakara, Saison pluies, rainfall=200mm
Résultats : Linear -8%, Neural -6%, Seasonal -15% → Moyenne -10%
Analyse IA : Risque élevé de baisse (difficultés de collecte + saison défavorable)
```

### 3. Signal mixte (divergence à analyser)
```
Contexte : Antananarivo, TVA, croissance économique forte
Résultats : Linear +15%, Neural +18%, Seasonal +5% → Moyenne +13%
Analyse IA : Optimisme économique tempéré par saisonnalité. Recommandation : scénario moyen +10-12%
```

## 📚 Documentation

| Document | Contenu |
|----------|---------|
| **[QUICKSTART_PREDICTIONS.md](./QUICKSTART_PREDICTIONS.md)** | Installation, tests, dépannage |
| **[PREDICTION_METHODS_GUIDE.md](./PREDICTION_METHODS_GUIDE.md)** | Architecture détaillée, formules mathématiques, contribution |
| **[tensorflow-service/README.md](./tensorflow-service/README.md)** | API TensorFlow, endpoints, configuration |
| **[test/prediction-methods.test.ts](./test/prediction-methods.test.ts)** | Tests unitaires, exemples d'utilisation |

## 🛠️ Commandes utiles

```bash
# Tests
npm test prediction-methods.test.ts           # Tests unitaires
npx ts-node scripts/test-predictions.ts      # Test rapide complet

# Service TensorFlow
docker-compose up -d tf-service              # Démarrer
docker logs tf-service                       # Voir les logs
curl http://localhost:8501/health            # Health check

# Développement
docker-compose down tf-service               # Arrêter
docker-compose build tf-service              # Rebuild après modifications
```

## 🔧 Configuration

### Variables d'environnement

```env
# Service TensorFlow (Docker)
TF_SERVICE_URL=http://localhost:8501          # URL du service
TF_SERVICE_TIMEOUT=5000                       # Timeout en ms
TF_SERVICE_ENABLED=true                       # Activer/désactiver

# Contextes externes (déjà configurés)
OPENWEATHER_API_KEY=your_key                  # Météo
WB_INDICATOR_API_KEY=your_key                 # Économie (World Bank)
```

### Désactiver les prédictions

Si le service TensorFlow n'est pas disponible, le système continue de fonctionner :

```env
TF_SERVICE_ENABLED=false
```

**Comportement** :
- ✅ Régression linéaire : Fonctionne (local)
- ✅ Analyse saisonnière : Fonctionne (local)
- ⚠️ Réseau de neurones : Retourne 0% (fallback)
- ✅ L'analyse IA continue avec les 2 méthodes restantes

## 💰 Coût : 0€

- **TensorFlow.js** : Open-source
- **Images Docker** : Officielles gratuites
- **APIs** : OpenWeatherMap (free tier), World Bank (gratuit)
- **Hébergement** : Compatible free tiers (Render, Railway, Fly.io)

**Ressources** : ~200MB RAM, 0.5 vCPU pour le service TensorFlow

## ⚡ Performance

| Opération | Temps moyen |
|-----------|-------------|
| Régression linéaire | < 10ms |
| Analyse saisonnière | < 5ms |
| Neural (modèle générique) | ~100-200ms |
| Neural (entraînement ad-hoc) | ~2-5s |
| **Total (3 méthodes)** | **~200ms à 5s** |

## 🎓 Références techniques

**Régression linéaire** :
- Méthode : OLS (Ordinary Least Squares)
- Métrique : R² (coefficient de détermination)

**Réseau de neurones** :
- Framework : TensorFlow.js Node
- Architecture : MLP Sequential (Multi-Layer Perceptron)
- Couches : Dense(8, relu) → Dropout(0.2) → Dense(4, relu) → Dense(1, linear)
- Optimizer : Adam (learning rate 0.01)
- Loss : MSE (Mean Squared Error)
- Metric : MAE (Mean Absolute Error)

**Analyse saisonnière** :
- Inspiré de ARIMA mais simplifié
- Moyennes mobiles : Fenêtre 4 mois
- Facteurs saisonniers : Calibrés par type de recette et saison

## 🤝 Contribution

Pour améliorer les prédictions :

1. **Calibrer les facteurs saisonniers**
   - Fichier : `src/ai/prediction-methods.ts`
   - Fonction : `calculateSeasonalAdjustment()`
   - Basé sur vos données historiques réelles

2. **Ajuster l'architecture neuronale**
   - Fichier : `tensorflow-service/index.js`
   - Fonction : `createModel()`
   - Tester différentes configurations : [16,8], [8,8,4], etc.

3. **Ajouter des features au réseau**
   - Actuellement : [rainfall, seasonFactor, population, GDP]
   - Potentiel : Taux d'inflation, chômage, taux de change, etc.

---

**Version** : 1.0.0  
**Date** : 25 novembre 2024  
**Licence** : MIT
