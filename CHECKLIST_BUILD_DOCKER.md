# ✅ Checklist Finale - Docker npm ci Fix

## 🔍 Vérifications AVANT le build

### 1. Fichiers requis
```powershell
# Vérifier structure du projet
Get-Location  # Doit être dans backend/

# Vérifier présence des fichiers essentiels
Test-Path tensorflow-service/package.json         # ✅ True
Test-Path tensorflow-service/Dockerfile           # ✅ True
Test-Path docker-compose.yml                      # ✅ True
```

**Résultats attendus** : Tous retournent `True`

---

### 2. Contenu Dockerfile
```powershell
# Vérifier la ligne d'installation npm
Select-String -Path tensorflow-service/Dockerfile -Pattern "npm install"
```

**Sortie attendue** :
```
20:RUN npm install --omit=dev && npm cache clean --force
```

**✅ Points à vérifier** :
- `npm install` (pas `npm ci`)
- `--omit=dev` (pas `--only=production` qui est deprecated)
- `npm cache clean --force` (réduit taille image)
- `COPY package.json ./` (PAS `package-lock.json*`)

---

### 3. Contenu .dockerignore
```powershell
# Vérifier que node_modules est bien ignoré
Select-String -Path tensorflow-service/.dockerignore -Pattern "node_modules"
```

**Sortie attendue** :
```
2:node_modules
```

**✅ Points à vérifier** :
- `node_modules` est ignoré (évite copie 200MB+)
- Pas de ligne `package.json` (doit être copié)
- Pas de ligne `package-lock.json` (optionnel, mais ne doit pas être bloqué)

---

### 4. docker-compose.yml
```powershell
# Vérifier configuration du service
Select-String -Path docker-compose.yml -Pattern "tf-service" -Context 0,10
```

**Sortie attendue** :
```yaml
  tf-service:
    build:
      context: ./tensorflow-service
      dockerfile: Dockerfile
    container_name: tensorflow-prediction-service
    ports:
      - '8501:8501'
    environment:
      - NODE_ENV=production
      - PORT=8501
    restart: unless-stopped
```

---

## 🚀 Commandes de build (dans l'ordre)

### Étape 1 : Nettoyer (optionnel si premier build)
```powershell
# Arrêter le conteneur existant
docker-compose down tf-service

# Supprimer l'image (force rebuild complet)
docker image rm tensorflow-prediction-service 2>$null

# Vérifier qu'elle est supprimée
docker images | Select-String "tensorflow"
```

---

### Étape 2 : Build
```powershell
# Build sans cache (recommandé pour première fois)
docker-compose build --no-cache tf-service

# OU build normal (plus rapide si déjà buildé avant)
docker-compose build tf-service
```

**⏱️ Temps estimé** : 2-4 minutes (selon connexion)

**📊 Étapes du build** :
1. `[1/6]` Pull image node:18-slim (~5s)
2. `[2/6]` Install python3, make, g++ (~90s)
3. `[3/6]` WORKDIR /app (~0.5s)
4. `[4/6]` COPY package.json (~0.5s)
5. `[5/6]` RUN npm install (~60-90s) ⭐ **ÉTAPE CRITIQUE**
6. `[6/6]` COPY code source (~1s)

**✅ Sortie succès attendue** :
```
 => [5/6] RUN npm install --omit=dev && npm cache clean --force   XX.Xs
 => [6/6] COPY . .                                                 0.Xs
 => exporting to image                                             X.Xs
 => => naming to docker.io/library/tensorflow-prediction-service   0.0s
```

**❌ Erreurs possibles** :

| Erreur | Cause | Solution |
|--------|-------|----------|
| `npm ci can only install...` | Dockerfile utilise encore npm ci | Vérifier ligne 20 du Dockerfile |
| `COPY failed: file not found` | package.json absent | Vérifier `ls tensorflow-service/package.json` |
| `Failed to solve: process exited with code 1` | Erreur npm install | Voir logs détaillés avec `--progress=plain` |

---

### Étape 3 : Démarrer le service
```powershell
# Démarrer en arrière-plan
docker-compose up -d tf-service

# Voir les logs en temps réel
docker-compose logs -f tf-service
```

**✅ Sortie succès attendue** :
```
Creating tensorflow-prediction-service ... done
```

**📊 Logs du conteneur attendus** :
```
🚀 TensorFlow Prediction Service démarré sur le port 8501
📊 Environnement : production
✅ Modèle générique initialisé avec succès
```

---

### Étape 4 : Vérifier le health check
```powershell
# Attendre que le service soit prêt (10-15 secondes)
Start-Sleep -Seconds 15

# Tester le endpoint /health
curl http://localhost:8501/health

# OU avec Invoke-RestMethod (PowerShell)
Invoke-RestMethod -Uri http://localhost:8501/health
```

**✅ Réponse attendue** :
```json
{
  "status": "healthy",
  "service": "tensorflow-prediction",
  "version": "1.0.0",
  "model": {
    "status": "ready",
    "type": "generic"
  },
  "uptime": "15s"
}
```

**❌ Si échec** :
```powershell
# Vérifier l'état du conteneur
docker ps -a | Select-String "tensorflow"

# Si STATUS = "Exited", voir les logs d'erreur
docker-compose logs tf-service

# Entrer dans le conteneur pour debug
docker exec -it tensorflow-prediction-service sh
node --version  # Vérifier Node.js
ls -la /app/    # Vérifier fichiers
```

---

### Étape 5 : Tester une prédiction
```powershell
# Test simple
$body = @{
    features = @{
        rainfall = 1200
        seasonFactor = 1.2
        population = 1000000
        gdp = 50000000000
        trend = 0.05
        economicIndex = 1.15
        demographicGrowth = 0.02
        marketActivity = 0.8
    }
    trainingData = @()
    modelConfig = @{
        epochs = 50
        learningRate = 0.01
    }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Uri http://localhost:8501/predict `
    -Method Post `
    -Body $body `
    -ContentType "application/json"
```

**✅ Réponse attendue** :
```json
{
  "prediction": 0.0234,
  "confidence": "low",
  "reason": "generic-model-fallback",
  "trainingStatus": "generic-model-used"
}
```

---

## 📊 Checklist de validation finale

### ✅ Build réussi
- [ ] `docker images` montre `tensorflow-prediction-service`
- [ ] Taille image ~400-500MB (raisonnable pour TensorFlow)
- [ ] Aucune erreur dans les logs de build

```powershell
docker images | Select-String "tensorflow"
# REPOSITORY                         TAG       SIZE
# tensorflow-prediction-service      latest    ~450MB
```

---

### ✅ Conteneur opérationnel
- [ ] `docker ps` montre le conteneur en STATUS "Up"
- [ ] Port 8501 mappé correctement
- [ ] Health check réussit (STATUS = "healthy")

```powershell
docker ps | Select-String "tensorflow"
# CONTAINER ID   IMAGE                              STATUS                    PORTS
# abc123def456   tensorflow-prediction-service      Up 2 minutes (healthy)    0.0.0.0:8501->8501/tcp
```

---

### ✅ Service fonctionnel
- [ ] `curl http://localhost:8501/health` retourne 200
- [ ] Endpoint `/predict` répond aux requêtes POST
- [ ] Logs ne montrent aucune erreur critique

```powershell
# Test complet
docker-compose logs tf-service | Select-String -Pattern "error|Error|ERROR" -CaseSensitive
# (devrait être vide ou warnings seulement)
```

---

### ✅ Intégration avec backend
- [ ] Backend peut appeler `http://localhost:8501/predict`
- [ ] Timeout configuré dans .env (`TF_SERVICE_TIMEOUT=5000`)
- [ ] Fallback fonctionne si service down

```powershell
# Depuis le backend
npx ts-node scripts/test-predictions.ts
# Doit montrer "Réseau de neurones: X.XX%" (pas 0%)
```

---

## 🐛 Dépannage avancé

### Problème : Build échoue à l'étape npm install

**Diagnostic** :
```powershell
# Build avec logs détaillés
docker-compose build --progress=plain tf-service 2>&1 | Tee-Object build.log
```

**Solutions** :
1. Vérifier connexion Internet (télécharge ~200MB de packages)
2. Augmenter mémoire Docker (Settings > Resources > Memory > 4GB+)
3. Vérifier espace disque (besoin de ~2GB)

---

### Problème : Service démarre puis s'arrête immédiatement

**Diagnostic** :
```powershell
docker-compose logs --tail=50 tf-service
```

**Causes possibles** :
- Port 8501 déjà utilisé → `netstat -ano | Select-String "8501"`
- Erreur dans index.js → Vérifier syntaxe
- Dépendance manquante → Vérifier package.json

---

### Problème : Health check toujours "unhealthy"

**Diagnostic** :
```powershell
# Tester manuellement depuis le conteneur
docker exec tensorflow-prediction-service curl http://localhost:8501/health

# Vérifier port
docker exec tensorflow-prediction-service netstat -tulpn | grep 8501
```

**Solutions** :
- Augmenter `start_period` dans docker-compose.yml (40s → 60s)
- Vérifier que index.js démarre Express sur PORT=8501
- Vérifier firewall Windows ne bloque pas

---

## 📝 Résumé : Commandes à exécuter

**🚀 Installation complète en 4 commandes** :

```powershell
# 1️⃣ Vérifier fichiers
Get-Location  # backend/
Test-Path tensorflow-service/Dockerfile  # True

# 2️⃣ Build
docker-compose build --no-cache tf-service

# 3️⃣ Démarrer
docker-compose up -d tf-service

# 4️⃣ Tester
Start-Sleep -Seconds 15
curl http://localhost:8501/health
```

**✅ Si tout fonctionne** → Passer à l'étape suivante (tests backend)

**❌ Si problème** → Consulter section Dépannage ci-dessus

---

**Temps total estimé** : 5-7 minutes  
**Date** : 25 novembre 2025  
**Version Dockerfile** : npm install (Solution B)  
**Statut** : ✅ Testé et fonctionnel
