# Guide d'intégration Nominatim & Overpass - Gestion robuste des erreurs

## 📋 Vue d'ensemble

Ce document explique la refonte complète de la gestion d'erreurs pour les services géospatiaux (Nominatim / OSM, Overpass API) dans le backend NestJS.

### Problème initial

- ❌ **Erreurs 502 systématiques** : Toutes les erreurs Nominatim (403, 429, timeout) retournaient 502 "Bad Gateway"
- ❌ **Pas de typage des erreurs** : `throw new Error('service_error')` sans distinction
- ❌ **User-Agent invalide** : Blocage 403 par Nominatim pour non-respect de la usage policy
- ❌ **Pas de cache** : Appels répétés à Nominatim pour les mêmes villes
- ❌ **Pas de fallback** : Pas de bounding box par défaut pour les villes malgaches majeures

### Solution implémentée

✅ **Typage fort des erreurs** avec `GeocodingResult<T>`  
✅ **User-Agent conforme** à la policy Nominatim  
✅ **Codes HTTP appropriés** (403, 404, 429, 503, 504 au lieu de 502)  
✅ **Cache en mémoire** (TTL 1h) pour éviter les requêtes redondantes  
✅ **Fallbacks statiques** pour les grandes villes de Madagascar  
✅ **Rate limiting** (max 1 req/sec) conforme à Nominatim  

---

## 🏗️ Architecture des modifications

### 1. Types de géolocalisation (`place.service.ts`)

```typescript
export type GeocodingResult<T> = 
  | { success: true; data: T }
  | { success: false; error: GeocodingError };

export type GeocodingErrorType = 
  | 'NOT_FOUND'           // Ville introuvable (404)
  | 'ACCESS_BLOCKED'      // 403 Nominatim (policy violation)
  | 'RATE_LIMITED'        // 429 Too many requests
  | 'SERVICE_UNAVAILABLE' // 5xx erreurs serveur OSM
  | 'TIMEOUT'             // Timeout réseau
  | 'INVALID_RESPONSE'    // Réponse mal formée
  | 'NETWORK_ERROR';      // Erreur réseau générique

export interface GeocodingError {
  type: GeocodingErrorType;
  message: string;
  statusCode?: number;
  details?: any;
  canRetry: boolean;
}
```

### 2. Headers conformes à la policy Nominatim

```typescript
private getHeaders() {
  return {
    'User-Agent': 'MobilisationRecetteLocale/1.0 (contact@mobilisation-recette-madagascar.mg)',
    'Referer': 'https://mobilisation-recette-locale.mg',
    'Accept-Language': 'fr,en',
  };
}
```

⚠️ **ACTION REQUISE** : Remplacer `contact@mobilisation-recette-madagascar.mg` par votre **véritable email de contact**.

### 3. Cache en mémoire

```typescript
// PlaceService
private bboxCache = new Map<string, { bbox: CityBBox; timestamp: number }>();
private readonly cacheTTL = 3600000; // 1 heure
```

**Avantages** :
- Réduction drastique des appels à Nominatim
- Temps de réponse < 1ms pour les villes déjà recherchées
- Respect automatique du rate limiting

### 4. Fallbacks statiques pour Madagascar

```typescript
const MADAGASCAR_BBOX_FALLBACK: Record<string, CityBBox> = {
  'Antananarivo': { south: -18.9792, west: 47.4079, north: -18.7792, east: 47.6079, ... },
  'Toamasina': { south: -18.2443, west: 49.3122, north: -18.0443, east: 49.5122, ... },
  'Mahajanga': { south: -15.8167, west: 46.2167, north: -15.6167, east: 46.4167, ... },
  'Antsohihy': { south: -14.9789, west: 47.8894, north: -14.7789, east: 48.0894, ... },
  // ...
};
```

**Comportement** :
- Si Nominatim retourne une erreur (403, 429, 5xx, timeout), les fallbacks sont utilisés automatiquement
- Permet un fonctionnement dégradé même si OSM est bloqué

---

## 📡 Codes HTTP retournés par `/markets/by-city`

| Code | Erreur | Signification | Peut réessayer ? |
|------|--------|---------------|------------------|
| **200** | - | Succès (avec ou sans marchés trouvés) | - |
| **400** | `MISSING_PARAMETER` | Paramètre `ville` manquant | Non |
| **403** | `GEOCODING_BLOCKED` | Accès bloqué par Nominatim (User-Agent invalide) | Non |
| **404** | `CITY_NOT_FOUND` | Ville introuvable dans Nominatim | Non |
| **429** | `RATE_LIMIT_EXCEEDED` | Limite de fréquence dépassée | Oui (après 60s) |
| **503** | `GEOCODING_SERVICE_UNAVAILABLE` | Service Nominatim indisponible (5xx) | Oui |
| **503** | `OVERPASS_API_ERROR` | Erreur Overpass API | Oui |
| **504** | `GEOCODING_TIMEOUT` | Timeout lors de la géolocalisation | Oui |
| **502** | `INVALID_GEOCODING_RESPONSE` | Réponse Nominatim mal formée | Oui |
| **500** | `INTERNAL_ERROR` | Erreur interne non gérée | Non |

### Exemple de réponse en cas d'erreur 429

```json
{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Limite de fréquence dépassée pour le service de géolocalisation",
  "suggestion": "Veuillez réessayer dans quelques secondes",
  "canRetry": true,
  "retryAfter": 60
}
```

### Exemple de réponse en cas de succès

```json
{
  "type": "FeatureCollection",
  "metadata": {
    "ville": "Mahajanga",
    "bbox": {
      "south": -15.8167,
      "west": 46.2167,
      "north": -15.6167,
      "east": 46.4167,
      "display_name": "Mahajanga, Madagascar"
    },
    "count": 5,
    "source": "OpenStreetMap via Overpass API",
    "geocoding": {
      "provider": "Nominatim",
      "display_name": "Mahajanga, Madagascar"
    }
  },
  "features": [
    {
      "type": "Feature",
      "properties": {
        "id": 123456789,
        "name": "Marché de Mahajanga",
        "amenity": "marketplace",
        "ville": "Mahajanga",
        "source": "OpenStreetMap"
      },
      "geometry": {
        "type": "Point",
        "coordinates": [46.3167, -15.7167]
      }
    }
  ]
}
```

---

## ✅ Checklist de conformité Nominatim

### 1. User-Agent valide

- [ ] **Remplacer l'email** dans `place.service.ts` ligne ~88 :
  ```typescript
  'User-Agent': 'MobilisationRecetteLocale/1.0 (votre.email@reel.com)'
  ```
- [ ] Format : `AppName/Version (contact@email.com)` ou URL de contact
- [ ] Éviter les User-Agents génériques (`axios`, `node-fetch`, etc.)

Référence : https://operations.osmfoundation.org/policies/nominatim/

### 2. Rate limiting

- [x] **Max 1 requête/seconde** : Implémenté via `waitForRateLimit()`
- [x] **Pas de requêtes parallèles** : Une seule instance `PlaceService` avec rate limiting synchrone
- [ ] **Envisager un délai plus long** : Si vous faites beaucoup de requêtes, passer à 2 secondes (`minRequestInterval = 2000`)

### 3. Cache et optimisation

- [x] **Cache en mémoire** : TTL 1 heure
- [ ] **Optionnel** : Migrer vers Redis pour un cache partagé entre instances
- [ ] **Optionnel** : Pré-charger les bbox des villes majeures au démarrage

### 4. Monitoring

- [ ] **Logger les erreurs 403** : Indiquer un problème de configuration
- [ ] **Logger les erreurs 429** : Indiquer un dépassement de rate limiting
- [ ] **Surveiller les taux de cache hit** : Optimiser les fallbacks si nécessaire

---

## 🧪 Tests manuels

### Test 1 : Ville avec fallback (Mahajanga)

```bash
# PowerShell
Invoke-WebRequest -Uri "http://localhost:3000/serviceprediction/markets/by-city?ville=Mahajanga" -Method GET | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

**Résultat attendu** :
- ✅ Status 200
- ✅ `metadata.ville = "Mahajanga"`
- ✅ `metadata.count >= 0` (peut être 0 si aucun marché dans OSM)
- ✅ Console backend : `[PlaceService] Using cached bbox for Mahajanga` (après 1er appel)

### Test 2 : Ville introuvable

```bash
Invoke-WebRequest -Uri "http://localhost:3000/serviceprediction/markets/by-city?ville=VilleInexistante123" -Method GET
```

**Résultat attendu** :
- ✅ Status 404
- ✅ JSON :
  ```json
  {
    "error": "CITY_NOT_FOUND",
    "message": "La ville \"VilleInexistante123\" n'a pas été trouvée dans Nominatim",
    "canRetry": false
  }
  ```

### Test 3 : Ville avec accents (Toamasina)

```bash
Invoke-WebRequest -Uri "http://localhost:3000/serviceprediction/markets/by-city?ville=Toamasina" -Method GET | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

**Résultat attendu** :
- ✅ Status 200
- ✅ Marchés récupérés ou liste vide

### Test 4 : Vérifier le cache

```bash
# 1er appel (devrait appeler Nominatim)
Measure-Command { Invoke-WebRequest -Uri "http://localhost:3000/serviceprediction/markets/by-city?ville=Antsirabe" }

# 2ème appel immédiat (devrait utiliser le cache)
Measure-Command { Invoke-WebRequest -Uri "http://localhost:3000/serviceprediction/markets/by-city?ville=Antsirabe" }
```

**Résultat attendu** :
- 1er appel : ~1-2 secondes (réseau + Nominatim + Overpass)
- 2ème appel : ~200-500ms (cache + Overpass)
- Console : `[PlaceService] Using cached bbox for Antsirabe`

### Test 5 : Simuler une erreur 403 (optionnel)

Pour tester la gestion du 403, vous pouvez temporairement :
1. Modifier le User-Agent pour le rendre invalide : `'User-Agent': 'test'`
2. Relancer le serveur
3. Faire un appel :
   ```bash
   Invoke-WebRequest -Uri "http://localhost:3000/serviceprediction/markets/by-city?ville=Mahajanga"
   ```

**Résultat attendu** :
- ✅ Status 200 (grâce au fallback !)
- ✅ Console : `[PlaceService] Using fallback after 403 error for Mahajanga`

---

## 🚀 Migration Redis (optionnel)

Pour un cache partagé entre plusieurs instances du backend :

### Installation

```bash
npm install ioredis @types/ioredis
```

### Modification de `PlaceService`

```typescript
import Redis from 'ioredis';

export class PlaceService {
  private redis: Redis;
  private readonly cacheTTL = 3600; // secondes

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    });
  }

  private async getCachedBBox(city: string): Promise<CityBBox | null> {
    const key = `nominatim:bbox:${this.normalizeCityName(city)}`;
    const cached = await this.redis.get(key);
    
    if (cached) {
      console.log(`[PlaceService] Redis cache hit for ${city}`);
      return JSON.parse(cached);
    }
    
    return null;
  }

  private async setCachedBBox(city: string, bbox: CityBBox): Promise<void> {
    const key = `nominatim:bbox:${this.normalizeCityName(city)}`;
    await this.redis.setex(key, this.cacheTTL, JSON.stringify(bbox));
  }
}
```

---

## 📊 Monitoring et logs recommandés

### Métriques à surveiller

1. **Taux de cache hit** :
   ```typescript
   let cacheHits = 0;
   let cacheMisses = 0;
   
   // Dans getCachedBBox
   if (cached) {
     cacheHits++;
     console.log(`[PlaceService] Cache hit rate: ${(cacheHits / (cacheHits + cacheMisses) * 100).toFixed(2)}%`);
   } else {
     cacheMisses++;
   }
   ```

2. **Erreurs Nominatim par type** :
   ```typescript
   const errorCounts = new Map<GeocodingErrorType, number>();
   
   // Dans classifyError
   errorCounts.set(error.type, (errorCounts.get(error.type) || 0) + 1);
   ```

3. **Temps de réponse Nominatim** :
   ```typescript
   const start = Date.now();
   const resp = await axios.get(...);
   console.log(`[PlaceService] Nominatim responded in ${Date.now() - start}ms`);
   ```

### Alertes à configurer

- 🚨 **Plus de 5 erreurs 403 en 1h** → Problème de User-Agent
- 🚨 **Plus de 10 erreurs 429 en 1h** → Rate limiting dépassé
- 🚨 **Taux de cache hit < 70%** → Trop de villes différentes recherchées
- 🚨 **Temps de réponse Nominatim > 5s** → Service OSM lent

---

## 🔧 Variables d'environnement recommandées

Ajouter dans `.env` :

```env
# Nominatim Configuration
NOMINATIM_USER_AGENT=MobilisationRecetteLocale/1.0 (votre.email@reel.com)
NOMINATIM_REFERER=https://mobilisation-recette-locale.mg
NOMINATIM_TIMEOUT_MS=10000
NOMINATIM_RATE_LIMIT_MS=1000
NOMINATIM_CACHE_TTL_SECONDS=3600

# Redis (si migration)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

Puis dans `place.service.ts` :

```typescript
private getHeaders() {
  return {
    'User-Agent': process.env.NOMINATIM_USER_AGENT || 'MobilisationRecetteLocale/1.0',
    'Referer': process.env.NOMINATIM_REFERER,
  };
}
```

---

## 📚 Références

- **Nominatim Usage Policy** : https://operations.osmfoundation.org/policies/nominatim/
- **Overpass API** : https://wiki.openstreetmap.org/wiki/Overpass_API
- **OSM Tile Usage Policy** : https://operations.osmfoundation.org/policies/tiles/
- **Axios Timeout Configuration** : https://axios-http.com/docs/req_config

---

## 🎯 Résumé des changements

| Avant | Après |
|-------|-------|
| `throw new Error('service_error')` | `GeocodingResult<T>` typé |
| User-Agent générique → 403 | User-Agent conforme à la policy |
| Toutes erreurs → 502 | Codes HTTP appropriés (403, 404, 429, 503, 504) |
| Pas de cache | Cache en mémoire (TTL 1h) |
| Pas de fallback | Fallbacks statiques pour 7 villes majeures |
| Pas de rate limiting | Max 1 req/sec |
| Messages d'erreur techniques | JSON explicites avec suggestions |

---

## ✅ Actions immédiates

1. **Remplacer l'email dans le User-Agent** (`place.service.ts` ligne ~88)
2. **Tester les endpoints** avec les commandes PowerShell ci-dessus
3. **Vérifier les logs** : Pas d'erreurs 403, cache fonctionnel
4. **Documenter pour le frontend** : Les nouveaux codes d'erreur et leur signification
5. **Optionnel** : Migrer vers Redis si vous avez plusieurs instances backend

---

**Auteur** : GitHub Copilot  
**Date** : Novembre 2025  
**Version** : 1.0
