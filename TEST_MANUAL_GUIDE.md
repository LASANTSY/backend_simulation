# Guide de test manuel - Endpoints Nominatim/Overpass

## Prérequis

1. **Serveur backend lancé** sur `http://localhost:3000`
2. **PowerShell 5.1+** (Windows) ou terminal Bash/Zsh (Linux/Mac)

---

## 🧪 Tests PowerShell (Windows)

### Test 1 : Ville majeure avec fallback (Mahajanga)

```powershell
Invoke-WebRequest -Uri "http://localhost:3000/serviceprediction/markets/by-city?ville=Mahajanga" -Method GET | 
  Select-Object StatusCode, @{Name='Body';Expression={$_.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10}}
```

**✅ Résultat attendu :**
- Status : `200`
- Body contient : `"type": "FeatureCollection"`
- Body contient : `"ville": "Mahajanga"`
- Body contient : `"count": <nombre de marchés>`

---

### Test 2 : Ville problématique des logs (Antsohihy)

```powershell
$response = Invoke-WebRequest -Uri "http://localhost:3000/serviceprediction/markets/by-city?ville=Antsohihy" -Method GET
$json = $response.Content | ConvertFrom-Json

Write-Host "Status: $($response.StatusCode)"
Write-Host "Ville: $($json.metadata.ville)"
Write-Host "Marchés trouvés: $($json.features.Count)"
Write-Host "BBox: [$($json.metadata.bbox.south), $($json.metadata.bbox.west), $($json.metadata.bbox.north), $($json.metadata.bbox.east)]"
```

**✅ Résultat attendu :**
- Status : `200`
- Console backend : `[PlaceService] Using fallback for Antsohihy` ou `[PlaceService] BBox récupérée via Nominatim`

---

### Test 3 : Ville inexistante

```powershell
try {
    Invoke-WebRequest -Uri "http://localhost:3000/serviceprediction/markets/by-city?ville=VilleInexistante123" -Method GET
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $responseBody = $reader.ReadToEnd()
    $json = $responseBody | ConvertFrom-Json
    
    Write-Host "Status: $statusCode"
    Write-Host "Erreur: $($json.error)"
    Write-Host "Message: $($json.message)"
}
```

**✅ Résultat attendu :**
- Status : `404`
- Erreur : `CITY_NOT_FOUND`
- Message : `La ville "VilleInexistante123" n'a pas été trouvée dans Nominatim`

---

### Test 4 : Paramètre manquant

```powershell
try {
    Invoke-WebRequest -Uri "http://localhost:3000/serviceprediction/markets/by-city" -Method GET
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "Status: $statusCode (attendu: 400)"
}
```

**✅ Résultat attendu :**
- Status : `400`
- Erreur : `MISSING_PARAMETER`

---

### Test 5 : Vérifier le cache (2 appels successifs)

```powershell
Write-Host "`n=== Test du cache ===`n"

# 1er appel
Write-Host "1er appel (devrait appeler Nominatim ou utiliser fallback):"
$time1 = Measure-Command {
    $response1 = Invoke-WebRequest -Uri "http://localhost:3000/serviceprediction/markets/by-city?ville=Fianarantsoa" -Method GET
}
Write-Host "Temps: $($time1.TotalMilliseconds)ms"
Write-Host "Status: $($response1.StatusCode)`n"

# Attendre un peu pour séparer les logs
Start-Sleep -Milliseconds 500

# 2ème appel
Write-Host "2ème appel (devrait utiliser le cache):"
$time2 = Measure-Command {
    $response2 = Invoke-WebRequest -Uri "http://localhost:3000/serviceprediction/markets/by-city?ville=Fianarantsoa" -Method GET
}
Write-Host "Temps: $($time2.TotalMilliseconds)ms"
Write-Host "Status: $($response2.StatusCode)`n"

# Comparaison
if ($time2.TotalMilliseconds -lt $time1.TotalMilliseconds) {
    $speedup = [math]::Round(($time1.TotalMilliseconds - $time2.TotalMilliseconds) / $time1.TotalMilliseconds * 100, 1)
    Write-Host "✅ Le cache accélère les requêtes de $speedup%" -ForegroundColor Green
} else {
    Write-Host "⚠️ Pas d'amélioration visible (peut-être déjà en cache)" -ForegroundColor Yellow
}
```

**✅ Résultat attendu :**
- 1er appel : ~800-1600ms
- 2ème appel : ~200-500ms
- Console backend : `[PlaceService] Using cached bbox for Fianarantsoa`

---

### Test 6 : Toutes les villes avec fallback

```powershell
$cities = @('Antananarivo', 'Toamasina', 'Mahajanga', 'Antsohihy', 'Fianarantsoa', 'Toliara', 'Antsiranana')

foreach ($city in $cities) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/serviceprediction/markets/by-city?ville=$city" -Method GET
        $json = $response.Content | ConvertFrom-Json
        Write-Host "✅ $city : $($json.features.Count) marchés trouvés" -ForegroundColor Green
    } catch {
        Write-Host "❌ $city : Erreur" -ForegroundColor Red
    }
}
```

**✅ Résultat attendu :**
- Toutes les villes retournent `200`
- Console backend : Mix de cache hits et fallbacks

---

### Test 7 : Script de test automatisé complet

```powershell
cd "d:\Projet L3\Mobilisation recette locale\backend"
.\scripts\test-markets-by-city.ps1
```

**✅ Résultat attendu :**
- Tous les tests passent
- Taux de réussite : `100%`

---

## 🧪 Tests cURL (Linux/Mac/Git Bash)

### Test 1 : Ville majeure (Mahajanga)

```bash
curl -X GET "http://localhost:3000/serviceprediction/markets/by-city?ville=Mahajanga" \
  -H "Accept: application/json" \
  | jq '.metadata.ville, .features | length'
```

**✅ Résultat attendu :**
```json
"Mahajanga"
5
```

---

### Test 2 : Ville inexistante

```bash
curl -X GET "http://localhost:3000/serviceprediction/markets/by-city?ville=VilleInexistante" \
  -H "Accept: application/json" \
  -w "\nHTTP Status: %{http_code}\n" \
  | jq '.error, .message'
```

**✅ Résultat attendu :**
```json
"CITY_NOT_FOUND"
"La ville \"VilleInexistante\" n'a pas été trouvée dans Nominatim"
HTTP Status: 404
```

---

### Test 3 : Vérifier le cache

```bash
# 1er appel
echo "1er appel:"
time curl -s "http://localhost:3000/serviceprediction/markets/by-city?ville=Toamasina" > /dev/null

# Attendre 1 seconde
sleep 1

# 2ème appel
echo "2ème appel (devrait être plus rapide):"
time curl -s "http://localhost:3000/serviceprediction/markets/by-city?ville=Toamasina" > /dev/null
```

**✅ Résultat attendu :**
- 1er appel : `real 0m1.234s`
- 2ème appel : `real 0m0.321s` (beaucoup plus rapide)

---

### Test 4 : Toutes les villes avec fallback

```bash
cities=("Antananarivo" "Toamasina" "Mahajanga" "Antsohihy" "Fianarantsoa" "Toliara" "Antsiranana")

for city in "${cities[@]}"; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/serviceprediction/markets/by-city?ville=$city")
  if [ $status -eq 200 ]; then
    echo "✅ $city : HTTP $status"
  else
    echo "❌ $city : HTTP $status"
  fi
done
```

**✅ Résultat attendu :**
```
✅ Antananarivo : HTTP 200
✅ Toamasina : HTTP 200
✅ Mahajanga : HTTP 200
...
```

---

## 📊 Tests de charge (optionnels)

### Test avec Apache Bench (ab)

```bash
# 100 requêtes avec 10 en parallèle
ab -n 100 -c 10 "http://localhost:3000/serviceprediction/markets/by-city?ville=Mahajanga"
```

**✅ Résultat attendu :**
- Taux de réussite : `100%`
- Temps moyen : `< 500ms` (grâce au cache)
- Aucune erreur 502, 403, ou 429

---

### Test avec Artillery (si installé)

```bash
npm install -g artillery

artillery quick --count 50 --num 5 "http://localhost:3000/serviceprediction/markets/by-city?ville=Mahajanga"
```

**✅ Résultat attendu :**
- 50 requêtes en 5 vagues
- Toutes retournent `200`
- Median latency : `< 300ms`

---

## 🔍 Vérification des logs backend

Pendant les tests, surveillez la console du serveur backend :

### Logs de succès attendus

```log
[PlaceService] Rate limiting: waiting 1000ms...
[PlaceService] BBox récupérée pour "Mahajanga" via Nominatim
[PlaceService] Using cached bbox for Mahajanga
[OverpassController] 5 marchés trouvés pour Mahajanga
GET /serviceprediction/markets/by-city?ville=Mahajanga 200 856.234 ms
```

### Logs de fallback attendus

```log
[PlaceService] Ville "Antsohihy" non trouvée dans Nominatim, utilisation du fallback
[PlaceService] Using fallback after 403 error for Antsohihy
[OverpassController] 3 marchés trouvés pour Antsohihy
GET /serviceprediction/markets/by-city?ville=Antsohihy 200 723.112 ms
```

### Logs d'erreur attendus (ville inexistante)

```log
[PlaceService] Erreur lors de la géolocalisation de "VilleInexistante123": type=NOT_FOUND, message=Ville introuvable
GET /serviceprediction/markets/by-city?ville=VilleInexistante123 404 421.003 ms
```

### ❌ Logs à NE PAS voir

```log
❌ markets/by-city error Error: service_error
❌ GET /serviceprediction/markets/by-city?ville=... 502 ...
❌ [PlaceService] 403 Access Blocked by Nominatim
```

---

## ✅ Checklist de validation

Cochez après chaque test réussi :

- [ ] **Test 1** : Mahajanga retourne 200 avec marchés
- [ ] **Test 2** : Antsohihy retourne 200 (fallback fonctionne)
- [ ] **Test 3** : Ville inexistante retourne 404 CITY_NOT_FOUND
- [ ] **Test 4** : Paramètre manquant retourne 400
- [ ] **Test 5** : Le cache accélère les requêtes répétées
- [ ] **Test 6** : Toutes les villes avec fallback retournent 200
- [ ] **Test 7** : Script automatisé passe tous les tests
- [ ] **Logs** : Pas d'erreurs 502, 403, ou 429
- [ ] **Logs** : Messages de cache visibles
- [ ] **Logs** : Messages de fallback visibles

---

## 🛠️ Dépannage

### Erreur : "Impossible de se connecter au serveur"

```powershell
# Vérifier que le serveur est lancé
Get-Process node

# Relancer le serveur
cd "d:\Projet L3\Mobilisation recette locale\backend"
npm run start:dev
```

---

### Erreur : Toujours 502 après correction

```powershell
# 1. Vérifier que le code a été recompilé
Get-ChildItem "dist/integrations/place.service.js" | Select-Object LastWriteTime

# 2. Forcer une recompilation
npm run build

# 3. Redémarrer le serveur
npm run start:dev
```

---

### Erreur : 403 Access Blocked même après correction

```powershell
# 1. Vérifier le User-Agent dans le code
Select-String -Path "src/integrations/place.service.ts" -Pattern "User-Agent"

# 2. Vérifier que l'email a été changé
# ⚠️ NE DOIT PAS contenir "@example.com"

# 3. Attendre 24h si banni temporairement par Nominatim
# (ou utiliser les fallbacks qui doivent fonctionner)
```

---

### Erreur : Cache ne fonctionne pas

```powershell
# Vérifier les logs pour "Using cached bbox"
# Si absent, vérifier :

# 1. Que la normalisation des noms fonctionne
Write-Host "Test normalisation:"
$city1 = "  Mahajanga  "
$city2 = "Mahajanga"
# Les deux devraient donner le même cache key

# 2. Que le TTL n'est pas expiré (1 heure par défaut)
# Faire 2 appels espacés de < 10 secondes
```

---

## 📚 Ressources

- **Documentation Nominatim** : https://nominatim.org/release-docs/latest/api/Search/
- **Policy Nominatim** : https://operations.osmfoundation.org/policies/nominatim/
- **Overpass API** : https://wiki.openstreetmap.org/wiki/Overpass_API
- **Guide complet** : `NOMINATIM_INTEGRATION_GUIDE.md`
- **Analyse technique** : `TECHNICAL_ANALYSIS_502.md`

---

**Auteur** : GitHub Copilot  
**Date** : Novembre 2025
