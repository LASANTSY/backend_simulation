# 🚀 Commandes Essentielles - Système de Prédictions Quantitatives

## Installation et Démarrage

```bash
# 1️⃣ Configuration (copier les variables dans .env)
TF_SERVICE_URL=http://localhost:8501
TF_SERVICE_TIMEOUT=5000
TF_SERVICE_ENABLED=true

# 2️⃣ Démarrer le service TensorFlow
docker-compose up -d tf-service

# 3️⃣ Vérifier le service
curl http://localhost:8501/health

# 4️⃣ Démarrer le backend NestJS
npm run start:dev
```

---

## Tests

```bash
# Tests unitaires (Jest)
npm test prediction-methods.test.ts

# Tests avec couverture
npm test -- --coverage prediction-methods.test.ts

# Test rapide complet
npx ts-node scripts/test-predictions.ts

# Mode watch
npm test -- --watch prediction-methods.test.ts
```

---

## Service TensorFlow (Docker)

```bash
# Démarrer
docker-compose up -d tf-service

# Voir les logs
docker-compose logs -f tf-service

# Redémarrer
docker-compose restart tf-service

# Arrêter
docker-compose down tf-service

# Rebuild après modifications
docker-compose build tf-service
docker-compose up -d tf-service

# Inspecter le conteneur
docker exec -it tensorflow-prediction-service sh
```

---

## Service TensorFlow (Sans Docker)

```bash
# Installation
cd tensorflow-service
npm install

# Démarrer en développement
npm start

# Démarrer avec nodemon
npm run dev
```

---

## Tests manuels du service TensorFlow

```bash
# Health check
curl http://localhost:8501/health

# Prédiction simple (modèle générique)
curl -X POST http://localhost:8501/predict \
  -H "Content-Type: application/json" \
  -d '{
    "features": [[0.25, 1.10, 0.775, 0.75]]
  }'

# Prédiction avec entraînement ad-hoc
curl -X POST http://localhost:8501/predict \
  -H "Content-Type: application/json" \
  -d '{
    "features": [[0.25, 1.10, 0.775, 0.75]],
    "trainingData": {
      "inputs": [[0.2,1.0,0.7,0.7], [0.3,1.1,0.75,0.72], [0.25,1.05,0.73,0.71]],
      "outputs": [5.2, 6.8, 6.0]
    },
    "modelConfig": {
      "layers": [8, 4],
      "epochs": 50,
      "learningRate": 0.01
    }
  }'

# Info sur le modèle
curl http://localhost:8501/model/info

# Réinitialiser le modèle
curl -X POST http://localhost:8501/model/reset
```

---

## Monitoring et Logs

```bash
# Logs backend (filtrer prédictions)
# Dans le terminal du backend :
# Chercher : [PredictionMethods], [TensorFlowClient], [AI enrichAnalysis]

# Logs TensorFlow en temps réel
docker-compose logs -f tf-service

# Logs TensorFlow (dernières 50 lignes)
docker-compose logs --tail=50 tf-service

# Logs d'un conteneur spécifique
docker logs tensorflow-prediction-service

# Suivre les logs avec timestamps
docker-compose logs -f --timestamps tf-service
```

---

## Dépannage

```bash
# Vérifier que le port 8501 est libre
netstat -an | findstr "8501"          # Windows
lsof -i :8501                         # Linux/Mac

# Vérifier l'état du service
docker ps | findstr tensorflow        # Windows
docker ps | grep tensorflow           # Linux/Mac

# Inspecter les variables d'environnement
echo %TF_SERVICE_URL%                 # Windows
echo $TF_SERVICE_URL                  # Linux/Mac

# Vérifier la connectivité réseau
curl -v http://localhost:8501/health

# Redémarrer complètement
docker-compose down
docker-compose up -d tf-service

# Nettoyer et reconstruire
docker-compose down
docker-compose build --no-cache tf-service
docker-compose up -d tf-service
```

---

## Développement

```bash
# Compiler TypeScript
npm run build

# Linter
npm run lint

# Formater le code
npm run format

# Vérifier les types
npx tsc --noEmit

# Exécuter un fichier TypeScript
npx ts-node src/ai/prediction-methods.ts

# Debug un test spécifique
npm test -- --testNamePattern="should compute linear regression"
```

---

## Gestion des données

```bash
# Exemples de données de test
# Fichier : scripts/test-predictions.ts
# Modifier les objets simulation1, simulation2, simulation3

# Tester avec vos propres données
npx ts-node -e "
  import { applyPredictionMethods } from './src/ai/prediction-methods';
  const sim = { /* votre simulation */ };
  const contexts = { /* vos contextes */ };
  applyPredictionMethods(sim, 'City', 'RecipeType', contexts)
    .then(r => console.log(r));
"
```

---

## Configuration avancée

```bash
# Modifier le timeout
# Dans .env :
TF_SERVICE_TIMEOUT=10000              # 10 secondes

# Désactiver temporairement TensorFlow
# Dans .env :
TF_SERVICE_ENABLED=false

# Utiliser un autre port
# Dans docker-compose.yml, changer :
#   ports:
#     - '9501:8501'
# Puis dans .env :
TF_SERVICE_URL=http://localhost:9501

# Utiliser le service dans un autre conteneur
# Dans .env (si backend aussi dans Docker) :
TF_SERVICE_URL=http://tf-service:8501
```

---

## Production

```bash
# Build optimisé
docker-compose -f docker-compose.prod.yml build tf-service

# Démarrer en mode production
docker-compose -f docker-compose.prod.yml up -d tf-service

# Limiter les ressources
docker-compose up -d --scale tf-service=1 \
  --cpus="0.5" --memory="256m" tf-service

# Logs en production (moins verbeux)
# Dans tensorflow-service/.env :
NODE_ENV=production
DEBUG=false
```

---

## Sauvegardes et restauration

```bash
# Sauvegarder l'image Docker
docker save tensorflow-prediction-service:latest | gzip > tf-service-backup.tar.gz

# Restaurer l'image
gunzip -c tf-service-backup.tar.gz | docker load

# Exporter les logs
docker-compose logs tf-service > tf-service-logs.txt

# Sauvegarder la configuration
cp .env .env.backup
cp docker-compose.yml docker-compose.yml.backup
```

---

## Performance et optimisation

```bash
# Analyser les performances Docker
docker stats tensorflow-prediction-service

# Profiler le service Node.js
# Dans tensorflow-service/index.js, ajouter :
# node --prof index.js
# Puis analyser :
# node --prof-process isolate-*.log > profile.txt

# Benchmarker les prédictions
time curl -X POST http://localhost:8501/predict \
  -H "Content-Type: application/json" \
  -d '{"features": [[0.25, 1.10, 0.775, 0.75]]}'
```

---

## Documentation

```bash
# Ouvrir la documentation
# Windows :
start PREDICTIONS_OVERVIEW.md
start QUICKSTART_PREDICTIONS.md
start PREDICTION_METHODS_GUIDE.md

# Linux/Mac :
open PREDICTIONS_OVERVIEW.md
# ou
xdg-open PREDICTIONS_OVERVIEW.md
```

---

## Checklist de déploiement

```bash
# ✅ Configuration
[ ] Variables TF_SERVICE_* dans .env
[ ] Service TensorFlow démarré : docker-compose up -d tf-service
[ ] Health check OK : curl http://localhost:8501/health

# ✅ Tests
[ ] Tests unitaires passent : npm test prediction-methods.test.ts
[ ] Test rapide OK : npx ts-node scripts/test-predictions.ts
[ ] Prédiction manuelle OK : curl POST /predict

# ✅ Backend
[ ] Backend démarre : npm run start:dev
[ ] Pas d'erreurs dans les logs : [PredictionMethods], [TensorFlowClient]
[ ] Analyse AI enrichie fonctionne : POST /api/analysis/:id/enrich

# ✅ Production
[ ] Docker Compose configuré
[ ] Healthcheck Docker actif
[ ] Logs monitored
[ ] Backup de configuration fait
```

---

## Ressources utiles

```bash
# Documentation TensorFlow.js
https://www.tensorflow.org/js

# Documentation Express
https://expressjs.com/

# Documentation Jest
https://jestjs.io/

# Docker Compose docs
https://docs.docker.com/compose/
```

---

**Version** : 1.0.0  
**Dernière mise à jour** : 25 novembre 2024
