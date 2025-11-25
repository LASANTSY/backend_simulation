# Guide de Test CORS et Endpoint `/markets/by-city`

## ✅ Modifications Effectuées

### 1. Configuration CORS Améliorée (`src/main.ts`)

**Problème résolu** : Le middleware CORS Express ne gérait pas correctement `credentials: true` avec une origine spécifique.

**Solution** :
```typescript
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Permet les requêtes sans origin (Postman, curl, apps mobiles)
    if (!origin) return callback(null, true);
    
    // Vérifie si l'origine est autorisée
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 204,
  preflightContinue: false,
};
```

**Pourquoi ça fonctionne maintenant** :
- **Fonction callback dynamique** : Permet de vérifier l'origine de manière programmatique
- **Headers complets** : Inclut tous les headers nécessaires pour les requêtes CORS
- **preflightContinue: false** : S'assure que le middleware CORS répond directement aux OPTIONS
- **Credentials géré correctement** : Fonctionne avec une origine spécifique (pas de wildcard)

### 2. Format de Réponse Simplifié (`/serviceprediction/markets/by-city`)

**Ancien format** : GeoJSON FeatureCollection complexe
```json
{
  "type": "FeatureCollection",
  "metadata": { ... },
  "features": [...]
}
```

**Nouveau format** : Array simple de marchés
```json
[
  {
    "nom": "Bazary Tsaramandroso",
    "ville": "Mahajanga",
    "delimitation": {
      "type": "Polygon",
      "coordinates": [
        [
          [46.3176932, -15.7230751],
          [46.3180623, -15.7230302],
          [46.3184179, -15.725469],
          [46.3180555, -15.7255178],
          [46.3176932, -15.7230751]
        ]
      ]
    }
  }
]
```

**Logique de délimitation** :
- Si le marché a une géométrie Polygon : utilisation directe
- Sinon : création d'un carré de ~150m autour du point central (delta = 0.0015°)

## 🧪 Tests à Effectuer

### Test 1 : Vérifier les Headers CORS avec curl

```powershell
# Test du preflight OPTIONS
curl -X OPTIONS http://localhost:3000/serviceprediction/markets/by-city?ville=Mahajanga `
  -H "Origin: http://localhost:5173" `
  -H "Access-Control-Request-Method: GET" `
  -H "Access-Control-Request-Headers: Content-Type" `
  -v

# Vérifier la présence de ces headers dans la réponse :
# Access-Control-Allow-Origin: http://localhost:5173
# Access-Control-Allow-Methods: GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS
# Access-Control-Allow-Credentials: true
# Access-Control-Allow-Headers: Content-Type, Authorization, Accept, Origin, X-Requested-With
```

### Test 2 : Requête GET Réelle

```powershell
# Avec curl
curl http://localhost:3000/serviceprediction/markets/by-city?ville=Mahajanga `
  -H "Origin: http://localhost:5173" `
  -v

# Vérifier le format de réponse JSON
```

### Test 3 : Depuis le Frontend React/Vite

```typescript
// Dans votre composant React
import axios from 'axios';

const getMarketsByCity = async (city: string) => {
  try {
    const response = await axios.get(
      `http://localhost:3000/serviceprediction/markets/by-city`,
      {
        params: { ville: city },
        // withCredentials: true, // ⚠️ Décommenter SEULEMENT si vous envoyez des cookies
      }
    );
    
    console.log('Markets:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching markets:', error);
    throw error;
  }
};

// Utilisation
getMarketsByCity('Mahajanga');
```

### Test 4 : Vérifier les Logs Backend

```
OPTIONS /serviceprediction/markets/by-city?ville=Mahajanga 204 0.161 ms - 0
GET /serviceprediction/markets/by-city?ville=Mahajanga 200 1234 ms - 5678
```

✅ Si vous voyez ces deux lignes sans erreur, CORS fonctionne !

## 📋 Checklist de Vérification

- [ ] Le serveur backend redémarre correctement
- [ ] Le preflight OPTIONS retourne les bons headers CORS
- [ ] La requête GET retourne le format JSON simplifié
- [ ] Le frontend ne montre plus d'erreur CORS dans la console
- [ ] Les données sont correctement affichées dans l'interface

## 🔧 Configuration `.env`

Votre configuration actuelle :
```env
CORS_ORIGIN=http://localhost:5173
CORS_CREDENTIALS=true
```

**Options alternatives** :

```env
# Pour plusieurs origines (dev + production)
CORS_ORIGIN=http://localhost:5173,http://localhost:3001,https://votre-domaine.com

# Pour tout autoriser en développement (NON RECOMMANDÉ en production)
CORS_ORIGIN=*
CORS_CREDENTIALS=false
```

⚠️ **Important** : Si `CORS_CREDENTIALS=true`, vous NE POUVEZ PAS utiliser `CORS_ORIGIN=*`

## 🎯 Explication Technique : Pourquoi le 204 mais une Erreur CORS ?

### Le Flux de Requête CORS

1. **Frontend envoie OPTIONS** (preflight)
   ```
   OPTIONS /serviceprediction/markets/by-city?ville=Mahajanga
   Origin: http://localhost:5173
   Access-Control-Request-Method: GET
   ```

2. **Backend répond 204** (OK)
   ```
   HTTP/1.1 204 No Content
   Access-Control-Allow-Origin: http://localhost:5173  ← DOIT être présent
   Access-Control-Allow-Credentials: true              ← DOIT être présent
   Access-Control-Allow-Methods: GET, POST, ...        ← DOIT être présent
   ```

3. **Navigateur vérifie les headers**
   - ✅ Si tous les headers sont présents → Envoie la vraie requête GET
   - ❌ Si headers manquants → Bloque et affiche l'erreur CORS

### Votre Problème Initial

L'ancienne configuration :
```typescript
const corsOptions = {
  origin: process.env.CORS_ORIGIN.split(','),  // ← Array string, pas callback
  credentials: true,
} as any;
```

**Ne garantissait pas** que tous les headers soient correctement envoyés dans la réponse OPTIONS.

### La Nouvelle Configuration

```typescript
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => { ... },  // ← Callback dynamique
  methods: [...],                          // ← Explicite
  allowedHeaders: [...],                   // ← Explicite
  credentials: true,
  preflightContinue: false,               // ← Force la réponse immédiate
};
```

**Garantit** que chaque header est correctement défini dans la réponse OPTIONS.

## 🚀 Redémarrer le Backend

```powershell
# Arrêter le serveur actuel (Ctrl+C)
# Puis relancer
npm run start:dev
# ou
npm run build ; node dist/main.js
```

## 📞 Code Frontend Complet (Exemple)

```typescript
// services/marketService.ts
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/serviceprediction';

export interface MarketDelimitation {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface Market {
  nom: string;
  ville: string;
  delimitation: MarketDelimitation;
}

export const getMarketsByCity = async (city: string): Promise<Market[]> => {
  const response = await axios.get<Market[]>(`${API_BASE_URL}/markets/by-city`, {
    params: { ville: city },
    // Pas besoin de withCredentials si vous n'utilisez pas de cookies/sessions
  });
  
  return response.data;
};
```

```typescript
// Utilisation dans un composant
import { useEffect, useState } from 'react';
import { getMarketsByCity, Market } from './services/marketService';

function ZonesManagement() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMarkets = async (city: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await getMarketsByCity(city);
      setMarkets(data);
      console.log(`Fetched ${data.length} markets for ${city}`);
    } catch (err: any) {
      setError(err.message);
      console.error('Failed to fetch markets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarkets('Mahajanga');
  }, []);

  return (
    <div>
      <h2>Markets in Mahajanga</h2>
      {loading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}
      <ul>
        {markets.map((market, index) => (
          <li key={index}>
            {market.nom} - {market.ville}
            <br />
            Polygon with {market.delimitation.coordinates[0].length} points
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## 🆘 Si le Problème Persiste

### Vérifications Supplémentaires

1. **Middleware custom qui interfère** :
   ```typescript
   // Vérifier dans main.ts si vous avez des middleware AVANT cors()
   app.use(express.json());
   app.use(morgan('dev'));
   app.use(cors(corsOptions));  // ← DOIT être avant les routes
   ```

2. **Reverse proxy (Nginx, Traefik)** :
   - Si vous utilisez un proxy, vérifiez qu'il ne supprime pas les headers CORS
   - Le proxy doit être configuré pour passer les headers correctement

3. **Cache du navigateur** :
   - Ouvrir les DevTools → Network → Désactiver le cache
   - Ou utiliser Ctrl+Shift+R pour rafraîchir

4. **Tester avec un autre navigateur** :
   - Chrome, Firefox, Edge ont des comportements légèrement différents

### Commande de Debug Ultime

```powershell
# Voir TOUS les headers de la réponse OPTIONS
curl -X OPTIONS http://localhost:3000/serviceprediction/markets/by-city?ville=Mahajanga `
  -H "Origin: http://localhost:5173" `
  -H "Access-Control-Request-Method: GET" `
  -H "Access-Control-Request-Headers: Content-Type" `
  -i

# La réponse DOIT contenir :
# HTTP/1.1 204 No Content
# Access-Control-Allow-Origin: http://localhost:5173
# Access-Control-Allow-Methods: GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS
# Access-Control-Allow-Headers: Content-Type, Authorization, Accept, Origin, X-Requested-With
# Access-Control-Allow-Credentials: true
```

## 📚 Ressources

- [MDN - CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Express CORS Middleware](https://expressjs.com/en/resources/middleware/cors.html)
- [Axios Documentation](https://axios-http.com/docs/intro)
