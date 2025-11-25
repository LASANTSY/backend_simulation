# ✅ Checklist Rapide : Correctifs Nominatim & Prédictions

## 🚨 Actions OBLIGATOIRES avant redémarrage

### 1. Modifier l'email de contact Nominatim
**Fichier** : `src/integrations/place.service.ts` ligne ~30

```typescript
// ❌ AVANT (email factice bloqué par OSM)
'User-Agent': 'MobilisationRecetteLocale/1.0 (madagascar.budget@example.com)'

// ✅ APRÈS (remplacer par VOTRE email réel)
'User-Agent': 'MobilisationRecetteLocale/1.0 (votre.email@domaine.mg)'
```

**Pourquoi** : OSM/Nominatim bloque les emails `@example.com` depuis leur policy 2023.

---

## 📝 Headers Nominatim

- [x] ✅ User-Agent personnalisé avec nom projet
- [ ] ⚠️ **EMAIL RÉEL requis** dans User-Agent
- [x] ✅ Referer ajouté (optionnel mais recommandé)
- [x] ✅ Rate limiting 1 req/sec implémenté
- [x] ✅ Fallback coordonnées statiques (8 villes malgaches)
- [x] ✅ Paramètre `countrycodes: 'mg'` pour Madagascar
- [x] ✅ Gestion erreur 403 avec logs détaillés
- [x] ✅ Retry 429 (too many requests) avec backoff x4

---

## 🤖 Paramètres TensorFlow

- [x] ✅ URL : `http://localhost:8501` (vérifier dans `.env`)
- [x] ✅ Timeout : 5000ms
- [x] ✅ Service actif : `docker-compose up -d tf-service`
- [x] ✅ Health check : `curl http://localhost:8501/health`
- [x] ✅ Validation minimale données : 6+ points historiques
- [x] ✅ Skip TensorFlow si `historical.length < 6`
- [x] ✅ Fallback heuristique si pas d'historique

---

## 📊 Logs et Monitoring

- [x] ✅ Tag `[PlaceService]` pour géolocalisation
- [x] ✅ Tag `[PredictionMethods]` pour prédictions
- [x] ✅ Niveau de confiance exposé : `confidence: 'high' | 'medium' | 'low' | 'very-low'`
- [x] ✅ Warnings explicites : `results.warning`
- [x] ✅ Logs 403 avec extrait body HTML OSM
- [x] ✅ Logs fallback coordonnées statiques
- [x] ✅ Logs heuristiques sectorielles appliquées

---

## 🧪 Tests rapides

### Test 1 : Rate limiting
```bash
# Lancer 3 requêtes successives (devrait voir "Rate limiting: waiting Xms...")
for i in {1..3}; do curl -X POST http://localhost:3000/serviceprediction/simulations -H "Content-Type: application/json" -d '{"city":"Toamasina","newAmount":100000}'; done
```

### Test 2 : Fallback ville malgache
```bash
# Devrait utiliser fallback Toamasina si Nominatim bloque
curl -X POST http://localhost:3000/serviceprediction/simulations \
  -H "Content-Type: application/json" \
  -d '{"city":"Toamasina","newAmount":100000,"revenueId":"68a0d073-6549-4eb9-888b-6f37c55df59a"}'
```

### Test 3 : Prédictions heuristiques sans historique
```bash
# Devrait retourner ~3-4% (heuristiques sectorielles) au lieu de 0.00%
curl -X POST http://localhost:3000/serviceprediction/simulations \
  -H "Content-Type: application/json" \
  -d '{"city":"Antananarivo","newAmount":100000,"revenueId":"..."}' | jq '.predictions'
```

**Résultats attendus** :
```json
{
  "linear": "3.50",
  "neural": "3.50",
  "seasonal": "10.00",
  "average": "6.75",
  "confidence": "very-low",
  "warning": "Aucune donnée historique disponible. Prédictions basées uniquement sur des heuristiques..."
}
```

---

## 🔍 Points à vérifier dans les logs

### ✅ Logs corrects
```
[PlaceService] Rate limiting: waiting 500ms...
[PlaceService] Successfully geocoded Toamasina via Nominatim
[PredictionMethods] ⚠️ No historical data available - predictions will be heuristic only
[PredictionMethods] Applied heuristic prediction: { linear: '3.50%', confidence: 'very-low' }
```

### ❌ Logs à corriger
```
Context auto-fetch failed: Error: service_error: Request failed with status code 403
[PredictionMethods] Linear prediction: 0.00%  # ← Devrait être 3-4% avec heuristiques
```

---

## 🚀 Commandes de redémarrage

```bash
# 1. Arrêter tout
docker-compose down
npm run stop  # ou Ctrl+C dans le terminal backend

# 2. Redémarrer TensorFlow
docker-compose up -d tf-service
docker-compose logs -f tf-service  # Vérifier "Model loaded" ou "Server running"

# 3. Redémarrer backend
npm run start:dev

# 4. Tester health
curl http://localhost:8501/health  # TensorFlow
curl http://localhost:3000/health  # Backend (si endpoint existe)
```

---

## 📋 Variables d'environnement (.env)

```bash
# TensorFlow
TF_SERVICE_URL=http://localhost:8501
TF_SERVICE_TIMEOUT=5000
TF_SERVICE_ENABLED=true

# Nominatim (pas de config nécessaire, rate limiting automatique)
```

---

## 🎯 Seuils de données pour prédictions

| Historique | Confidence | Méthodes disponibles |
|-----------|-----------|---------------------|
| 0 points | `very-low` | Heuristiques sectorielles uniquement |
| 1-2 points | `very-low` | Heuristiques + saisonnier basique |
| 3-5 points | `low` | Régression linéaire + saisonnier |
| 6-11 points | `medium` | Régression + TensorFlow + saisonnier |
| 12+ points | `high` | Toutes méthodes avec entraînement complet |

---

## 📚 Fichiers de documentation

- **Guide complet** : `FIX_NOMINATIM_PREDICTIONS.md` (documentation détaillée)
- **Commandes** : `COMMANDS_CHEATSHEET.md` (commandes Docker, tests, etc.)
- **Prédictions** : `PREDICTIONS_OVERVIEW.md` (vue d'ensemble système)
- **Index** : `DOCS_INDEX.md` (navigation documentation)

---

## 💡 Résumé en 30 secondes

1. **⚠️ Changer l'email** dans `place.service.ts` ligne 30 (obligatoire)
2. Rate limiting Nominatim 1 req/sec ajouté ✅
3. Fallback coordonnées statiques pour 8 villes malgaches ✅
4. Prédictions heuristiques (~3-4%) au lieu de 0% sans historique ✅
5. Niveau de confiance exposé (`very-low`, `low`, `medium`, `high`) ✅
6. TensorFlow skip si < 6 points historiques ✅

**Test rapide** : `curl -X POST .../simulations -d '{"city":"Toamasina",...}'` → devrait voir logs `[PlaceService] Using fallback` et prédictions > 0%.

---

**Version** : 1.0.0 | **Date** : 25 nov 2025
