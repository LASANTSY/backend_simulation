# 🎯 Système de Prédictions Quantitatives - Intégration au README Principal

## Section à ajouter au README.md principal

---

## 📊 Prédictions Quantitatives Multi-Méthodes

Le système d'analyse intègre désormais **3 méthodes de prédiction quantitatives** qui s'exécutent automatiquement avant l'analyse qualitative par l'IA :

### 🔢 Méthodes implémentées

1. **Régression linéaire** (TypeScript local)
   - Corrélations population/PIB vs. revenus
   - Détection de tendances temporelles
   - Ajustements météorologiques pour recettes foncières

2. **Réseau de neurones** (TensorFlow.js Docker)
   - Architecture MLP 2 couches [8, 4]
   - Features : [rainfall, seasonFactor, population, GDP]
   - Entraînement ad-hoc si ≥10 données historiques

3. **Analyse saisonnière** (TypeScript local)
   - Moyennes mobiles 4 mois
   - Facteurs calibrés par type de recette et saison
   - Ajustements spécifiques Madagascar

### 🚀 Démarrage rapide

```bash
# 1. Configuration
echo "TF_SERVICE_URL=http://localhost:8501" >> .env
echo "TF_SERVICE_ENABLED=true" >> .env

# 2. Démarrer le service TensorFlow
docker-compose up -d tf-service

# 3. Vérifier
curl http://localhost:8501/health

# 4. Tester
npx ts-node scripts/test-predictions.ts
```

### 📈 Exemple de résultat

```json
{
  "predictions": {
    "linear": 6.2,      // Régression linéaire
    "neural": 7.5,      // Réseau de neurones
    "seasonal": 7.0,    // Ajustement saisonnier
    "average": 6.9,     // Moyenne pondérée
    "baseline": 1200000 // Valeur de référence (MGA)
  }
}
```

Ces prédictions sont automatiquement **injectées dans le prompt AI** avec des instructions détaillées pour l'interprétation, permettant à l'IA de produire des analyses plus robustes et basées sur des signaux quantitatifs convergents.

### 📚 Documentation complète

- **[PREDICTIONS_OVERVIEW.md](./PREDICTIONS_OVERVIEW.md)** - Vue d'ensemble et cas d'usage
- **[QUICKSTART_PREDICTIONS.md](./QUICKSTART_PREDICTIONS.md)** - Installation et dépannage
- **[PREDICTION_METHODS_GUIDE.md](./PREDICTION_METHODS_GUIDE.md)** - Architecture détaillée
- **[tensorflow-service/README.md](./tensorflow-service/README.md)** - API TensorFlow

### ✅ Tests

```bash
# Tests unitaires
npm test prediction-methods.test.ts

# Test complet
npx ts-node scripts/test-predictions.ts
```

### 💰 Coût : 0€

- TensorFlow.js open-source
- Images Docker officielles gratuites
- APIs publiques gratuites (OpenWeatherMap free tier, World Bank)
- ~200MB RAM, 0.5 vCPU pour le service TensorFlow

---

## Fichiers créés/modifiés

### Nouveaux modules

- ✅ `src/ai/tensorflow.client.ts` - Client HTTP pour service TensorFlow
- ✅ `src/ai/prediction-methods.ts` - Fonction principale avec 3 méthodes
- ✅ `test/prediction-methods.test.ts` - Tests unitaires complets
- ✅ `scripts/test-predictions.ts` - Script de test rapide

### Service TensorFlow (Docker)

- ✅ `tensorflow-service/Dockerfile` - Image Node.js 18 + TensorFlow.js
- ✅ `tensorflow-service/package.json` - Dépendances
- ✅ `tensorflow-service/index.js` - API Express avec /predict et /health
- ✅ `tensorflow-service/README.md` - Documentation

### Configuration

- ✅ `docker-compose.yml` - Service tf-service ajouté
- ✅ `.env.example` - Variables TF_SERVICE_* ajoutées
- ✅ `src/ai/ai.service.ts` - Intégration dans enrichAnalysis() et buildPrompt()

### Documentation

- ✅ `PREDICTIONS_OVERVIEW.md` - Vue d'ensemble technique
- ✅ `QUICKSTART_PREDICTIONS.md` - Guide de démarrage
- ✅ `PREDICTION_METHODS_GUIDE.md` - Documentation complète (architecture, formules, contribution)

---

## Architecture mise à jour

```
┌─────────────────────────────────────────────────────────────────┐
│                    NestJS Backend (Port 3000)                   │
│                                                                  │
│  ┌──────────────────┐         ┌─────────────────────────┐      │
│  │  AIService       │────────▶│  prediction-methods.ts  │      │
│  │  enrichAnalysis()│         │  - Régression linéaire  │      │
│  └──────────────────┘         │  - Analyse saisonnière  │      │
│           │                    │  - Client TensorFlow    │      │
│           │                    └─────────────────────────┘      │
│           │                               │                     │
│           │                               │ HTTP POST /predict  │
│           ▼                               ▼                     │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  Prompt AI enrichi avec prédictions quantitatives    │      │
│  │  → OpenAI / Gemini                                   │      │
│  └──────────────────────────────────────────────────────┘      │
└──────────────────────────────────────┬───────────────────────────┘
                                        │
                                        │ HTTP
                                        │
┌───────────────────────────────────────▼───────────────────────────┐
│        Docker: tensorflow-prediction-service (Port 8501)         │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  TensorFlow.js Node API (Express)                          │ │
│  │  - POST /predict : Entraîne et prédit avec MLP [8,4,1]    │ │
│  │  - GET /health : Health check                             │ │
│  │  - GET /model/info : Info sur le modèle générique         │ │
│  └────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

---

## Workflow complet

1. **Appel API** : `POST /api/analysis/:id/enrich`
2. **Récupération contextes** : Météo, économie, démographie, saison
3. **✨ NOUVEAU : Prédictions quantitatives**
   - Régression linéaire (local)
   - Appel TensorFlow Docker pour neural network
   - Calcul ajustement saisonnier (local)
4. **Construction prompt enrichi** : Injection des 3 prédictions + instructions IA
5. **Appel OpenAI/Gemini** : Analyse qualitative basée sur signaux quantitatifs
6. **Réponse structurée** : JSON avec prédictions, interprétation, risques, opportunités, recommandations

---

## Impact sur les analyses IA

### Avant
```json
{
  "interpretation": "La simulation montre une croissance possible...",
  "confidence": 0.6
}
```

### Après
```json
{
  "interpretation": "Les trois méthodes convergent fortement (écart <3%) vers une croissance de 6-8% :
  - La régression linéaire (+6.2%) capte la corrélation démographique
  - Le réseau de neurones (+7.5%) détecte un effet multiplicateur saison sèche + météo favorable
  - L'analyse saisonnière (+7.0%) confirme le facteur positif de la saison
  Signal fort de croissance soutenable compte tenu des contextes.",
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

**Résultat** : Analyses plus **quantifiées**, **justifiées** et **crédibles**.

---

## Performance

| Opération | Temps |
|-----------|-------|
| Régression linéaire | < 10ms |
| Analyse saisonnière | < 5ms |
| Neural (générique) | ~100-200ms |
| Neural (entraînement) | ~2-5s |
| **Total** | **~200ms à 5s** |

---

## Commandes utiles

```bash
# Service TensorFlow
docker-compose up -d tf-service              # Démarrer
docker-compose logs -f tf-service            # Logs en temps réel
docker-compose restart tf-service            # Redémarrer
curl http://localhost:8501/health            # Health check

# Tests
npm test prediction-methods.test.ts          # Tests unitaires
npx ts-node scripts/test-predictions.ts     # Test complet

# Développement
cd tensorflow-service && npm install && npm start  # Sans Docker
```

---

## Variables d'environnement à ajouter

```env
# Service TensorFlow (Docker)
TF_SERVICE_URL=http://localhost:8501          # URL du service
TF_SERVICE_TIMEOUT=5000                       # Timeout en ms
TF_SERVICE_ENABLED=true                       # Activer/désactiver le service
```

**Note** : Si `TF_SERVICE_ENABLED=false`, le système continue de fonctionner avec les méthodes linéaire et saisonnière uniquement (fallback automatique).

---

## 🎓 En savoir plus

- [Documentation TensorFlow.js](https://www.tensorflow.org/js)
- [Guide complet des prédictions](./PREDICTION_METHODS_GUIDE.md)
- [Tests unitaires](./test/prediction-methods.test.ts)

---

**Contributeur** : Expert Backend Node.js/TypeScript + IA & Finance  
**Version** : 1.0.0  
**Date** : 25 novembre 2024
