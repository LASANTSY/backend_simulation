import axios from 'axios';

export interface CityBBox {
  south: number;
  west: number;
  north: number;
  east: number;
  display_name?: string;
}

/**
 * Types pour la gestion d'erreurs robuste
 */
export type GeocodingResult<T> = 
  | { success: true; data: T }
  | { success: false; error: GeocodingError };

export type GeocodingErrorType = 
  | 'NOT_FOUND'           // Ville introuvable
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

/**
 * Coordonnées statiques pour les principales villes malgaches
 * Utilisées comme fallback si Nominatim est indisponible
 */
const MADAGASCAR_CITIES_FALLBACK: Record<string, { lat: number; lon: number; display_name: string }> = {
  'Antananarivo': { lat: -18.8792, lon: 47.5079, display_name: 'Antananarivo, Madagascar' },
  'Toamasina': { lat: -18.1443, lon: 49.4122, display_name: 'Toamasina, Madagascar' },
  'Antsirabe': { lat: -19.8637, lon: 47.0366, display_name: 'Antsirabe, Madagascar' },
  'Mahajanga': { lat: -15.7167, lon: 46.3167, display_name: 'Mahajanga, Madagascar' },
  'Fianarantsoa': { lat: -21.4427, lon: 47.0857, display_name: 'Fianarantsoa, Madagascar' },
  'Toliara': { lat: -23.3500, lon: 43.6667, display_name: 'Toliara (Tuléar), Madagascar' },
  'Antsiranana': { lat: -12.2787, lon: 49.2917, display_name: 'Antsiranana (Diego-Suarez), Madagascar' },
  'Morondava': { lat: -20.2867, lon: 44.2833, display_name: 'Morondava, Madagascar' },
  'Antsohihy': { lat: -14.8789, lon: 47.9894, display_name: 'Antsohihy, Madagascar' },
};

/**
 * BBox statiques pour les principales villes (rayon ~20km)
 */
const MADAGASCAR_BBOX_FALLBACK: Record<string, CityBBox> = {
  'Antananarivo': { south: -18.9792, west: 47.4079, north: -18.7792, east: 47.6079, display_name: 'Antananarivo, Madagascar' },
  'Toamasina': { south: -18.2443, west: 49.3122, north: -18.0443, east: 49.5122, display_name: 'Toamasina, Madagascar' },
  'Mahajanga': { south: -15.8167, west: 46.2167, north: -15.6167, east: 46.4167, display_name: 'Mahajanga, Madagascar' },
  'Antsohihy': { south: -14.9789, west: 47.8894, north: -14.7789, east: 48.0894, display_name: 'Antsohihy, Madagascar' },
  'Fianarantsoa': { south: -21.5427, west: 46.9857, north: -21.3427, east: 47.1857, display_name: 'Fianarantsoa, Madagascar' },
  'Toliara': { south: -23.4500, west: 43.5667, north: -23.2500, east: 43.7667, display_name: 'Toliara (Tuléar), Madagascar' },
  'Antsiranana': { south: -12.3787, west: 49.1917, north: -12.1787, east: 49.3917, display_name: 'Antsiranana (Diego-Suarez), Madagascar' },
};

export class PlaceService {
  private readonly endpoint = 'https://nominatim.openstreetmap.org/search';
  private readonly timeoutMs = 10000;
  private lastRequestTime = 0;
  private readonly minRequestInterval = 1000; // 1 seconde entre requêtes (policy Nominatim)
  
  // Cache simple en mémoire pour éviter les requêtes répétées
  private bboxCache = new Map<string, { bbox: CityBBox; timestamp: number }>();
  private readonly cacheTTL = 3600000; // 1 heure

  /**
   * Rate limiting pour respecter la usage policy de Nominatim (max 1 req/sec)
   */
  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      console.log(`[PlaceService] Rate limiting: waiting ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Headers conformes à la usage policy de Nominatim
   * ⚠️ IMPORTANT : Remplacer l'email par une adresse réelle et valide
   * Voir https://operations.osmfoundation.org/policies/nominatim/
   */
  private getHeaders() {
    return {
      'User-Agent': 'MobilisationRecetteLocale/1.0 (contact@mobilisation-recette-madagascar.mg)', // ⚠️ CHANGER L'EMAIL
      'Referer': 'https://mobilisation-recette-locale.mg', // Optionnel mais recommandé
      'Accept-Language': 'fr,en', // Préférence pour les résultats en français
    };
  }
  
  /**
   * Normaliser les noms de villes pour le cache et les fallbacks
   */
  private normalizeCityName(city: string): string {
    return city.trim().replace(/\s+/g, ' ');
  }

  /**
   * Vérifier le cache avant d'appeler Nominatim
   */
  private getCachedBBox(city: string): CityBBox | null {
    const normalized = this.normalizeCityName(city);
    const cached = this.bboxCache.get(normalized);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      console.log(`[PlaceService] Using cached bbox for ${normalized}`);
      return cached.bbox;
    }
    
    return null;
  }

  /**
   * Enregistrer dans le cache
   */
  private setCachedBBox(city: string, bbox: CityBBox): void {
    const normalized = this.normalizeCityName(city);
    this.bboxCache.set(normalized, { bbox, timestamp: Date.now() });
  }

  /**
   * Convertir une erreur axios en GeocodingError typé
   */
  private classifyError(err: any, city: string): GeocodingError {
    // Timeout réseau
    if (err?.code === 'ECONNABORTED' || err?.message?.includes('timeout')) {
      return {
        type: 'TIMEOUT',
        message: `Timeout lors de la géolocalisation de "${city}"`,
        canRetry: true,
      };
    }

    const status = err?.response?.status;

    // 403 : Access Blocked (User-Agent invalide, policy violation)
    if (status === 403) {
      return {
        type: 'ACCESS_BLOCKED',
        message: 'Accès bloqué par Nominatim (vérifier User-Agent et respecter la policy)',
        statusCode: 403,
        details: err?.response?.data,
        canRetry: false,
      };
    }

    // 429 : Too Many Requests
    if (status === 429) {
      return {
        type: 'RATE_LIMITED',
        message: 'Limite de fréquence dépassée (429 Too Many Requests)',
        statusCode: 429,
        canRetry: true,
      };
    }

    // 5xx : Service Unavailable
    if (status && status >= 500) {
      return {
        type: 'SERVICE_UNAVAILABLE',
        message: `Service Nominatim indisponible (${status})`,
        statusCode: status,
        canRetry: true,
      };
    }

    // Erreurs réseau génériques
    if (err?.code === 'ENOTFOUND' || err?.code === 'ECONNREFUSED') {
      return {
        type: 'NETWORK_ERROR',
        message: `Erreur réseau : ${err.code}`,
        details: err?.message,
        canRetry: true,
      };
    }

    // Erreur générique
    return {
      type: 'NETWORK_ERROR',
      message: err?.message || 'Erreur inconnue lors de la géolocalisation',
      details: err,
      canRetry: false,
    };
  }

  /**
   * Récupérer la bounding box d'une ville via Nominatim avec gestion robuste des erreurs
   * @param city Nom de la ville
   * @returns GeocodingResult avec bbox ou erreur typée
   */
  async getCityBBox(city: string): Promise<GeocodingResult<CityBBox>> {
    const normalized = this.normalizeCityName(city);
    
    // 1. Vérifier le cache
    const cached = this.getCachedBBox(normalized);
    if (cached) {
      return { success: true, data: cached };
    }

    // 2. Vérifier les fallbacks statiques
    const fallback = MADAGASCAR_BBOX_FALLBACK[normalized];
    
    // 3. Rate limiting
    await this.waitForRateLimit();

    try {
      const resp = await axios.get(this.endpoint, {
        params: {
          q: city,
          format: 'json',
          limit: 1,
          countrycodes: 'mg', // Limiter à Madagascar pour éviter ambiguïtés
        },
        timeout: this.timeoutMs,
        headers: this.getHeaders(),
      });

      const data = resp.data;
      
      // Aucun résultat trouvé
      if (!Array.isArray(data) || data.length === 0) {
        if (fallback) {
          console.log(`[PlaceService] Ville "${normalized}" non trouvée dans Nominatim, utilisation du fallback`);
          this.setCachedBBox(normalized, fallback);
          return { success: true, data: fallback };
        }
        
        return {
          success: false,
          error: {
            type: 'NOT_FOUND',
            message: `Ville "${city}" introuvable dans Nominatim`,
            canRetry: false,
          },
        };
      }

      const first = data[0];
      const bb = first.boundingbox;
      
      // Réponse invalide
      if (!bb || bb.length < 4) {
        return {
          success: false,
          error: {
            type: 'INVALID_RESPONSE',
            message: 'Réponse Nominatim mal formée (boundingbox manquante)',
            details: first,
            canRetry: false,
          },
        };
      }

      // Nominatim boundingbox: [south, north, west, east]
      const bbox: CityBBox = {
        south: parseFloat(bb[0]),
        north: parseFloat(bb[1]),
        west: parseFloat(bb[2]),
        east: parseFloat(bb[3]),
        display_name: first.display_name,
      };

      // Valider les coordonnées
      if (isNaN(bbox.south) || isNaN(bbox.north) || isNaN(bbox.west) || isNaN(bbox.east)) {
        return {
          success: false,
          error: {
            type: 'INVALID_RESPONSE',
            message: 'Coordonnées invalides dans la réponse Nominatim',
            details: bb,
            canRetry: false,
          },
        };
      }

      console.log(`[PlaceService] BBox récupérée pour "${normalized}" via Nominatim`);
      this.setCachedBBox(normalized, bbox);
      return { success: true, data: bbox };

    } catch (err: any) {
      const error = this.classifyError(err, city);
      
      console.error(`[PlaceService] Erreur lors de la géolocalisation de "${city}":`, {
        type: error.type,
        message: error.message,
        statusCode: error.statusCode,
      });

      // Utiliser le fallback si disponible pour toutes les erreurs sauf NOT_FOUND
      if (fallback) {
        console.log(`[PlaceService] Utilisation du fallback après erreur ${error.type} pour "${normalized}"`);
        this.setCachedBBox(normalized, fallback);
        return { success: true, data: fallback };
      }

      return { success: false, error };
    }
  }

  // Get richer city info including lat/lon and address object when available
  async getCityInfo(city: string): Promise<{ lat: number; lon: number; display_name?: string; address?: any }> {
    // 1. Vérifier d'abord dans le fallback (villes malgaches connues)
    const normalizedCity = city.trim();
    const fallbackData = MADAGASCAR_CITIES_FALLBACK[normalizedCity];
    
    if (fallbackData) {
      console.log(`[PlaceService] Using fallback coordinates for ${normalizedCity}`);
    }

    await this.waitForRateLimit();

    // Retry a few times for transient network/server errors, and provide richer error info
    const maxAttempts = 3;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    let lastErr: any = null;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const resp = await axios.get(this.endpoint, {
          params: {
            q: city,
            format: 'json',
            limit: 1,
            addressdetails: 1,
            countrycodes: 'mg', // Limiter à Madagascar
          },
          timeout: this.timeoutMs,
          headers: this.getHeaders(),
        });

        const data = resp.data;
        if (!Array.isArray(data) || data.length === 0) {
          // Si Nominatim ne trouve rien, utiliser le fallback
          if (fallbackData) {
            console.log(`[PlaceService] Nominatim returned no results, using fallback for ${normalizedCity}`);
            return fallbackData;
          }
          throw new Error('not_found');
        }
        
        const first = data[0];
        const lat = parseFloat(first.lat);
        const lon = parseFloat(first.lon);
        
        console.log(`[PlaceService] Successfully geocoded ${city} via Nominatim`);
        return { lat, lon, display_name: first.display_name, address: first.address };
        
      } catch (err: any) {
        lastErr = err;
        
        // Cas spéciaux
        if (err?.message === 'not_found') {
          if (fallbackData) {
            console.log(`[PlaceService] City not found in Nominatim, using fallback for ${normalizedCity}`);
            return fallbackData;
          }
          throw err;
        }
        
        if (err?.code === 'ECONNABORTED') {
          // timeout: if last attempt, surface timeout, else retry
          if (attempt === maxAttempts) {
            console.error(`[PlaceService] Timeout after ${maxAttempts} attempts`);
            if (fallbackData) return fallbackData;
            throw new Error('timeout');
          }
          await sleep(200 * attempt);
          continue;
        }

        const status = err?.response?.status;
        
        // Gestion erreur 403 (policy violation)
        if (status === 403) {
          const errorBody = err?.response?.data;
          console.error('[PlaceService] 403 Access Blocked by Nominatim:', {
            city,
            attempt,
            body: typeof errorBody === 'string' ? errorBody.substring(0, 200) : errorBody,
            headers: this.getHeaders(),
          });
          
          // Ne pas retry sur 403 (c'est une erreur de configuration)
          if (fallbackData) {
            console.log(`[PlaceService] Using fallback after 403 error for ${normalizedCity}`);
            return fallbackData;
          }
          
          throw new Error(
            'service_error: Nominatim access blocked (403). ' +
            'Verify User-Agent email is valid and rate limiting is respected. ' +
            'See https://operations.osmfoundation.org/policies/nominatim/'
          );
        }

        // Retry on 5xx server errors or 429 (too many requests)
        if ((status && (status >= 500 || status === 429)) && attempt < maxAttempts) {
          console.warn(`[PlaceService] Retrying after status ${status} (attempt ${attempt}/${maxAttempts})...`);
          await sleep(250 * attempt * (status === 429 ? 4 : 1)); // Attendre plus longtemps pour 429
          continue;
        }

        // Non-retriable or final attempt: include response details when present
        if (attempt === maxAttempts) {
          const statusInfo = status ? `status=${status}` : `code=${err?.code ?? 'unknown'}`;
          const body = err?.response?.data ? ` body=${JSON.stringify(err.response.data).substring(0, 300)}` : '';
          const message = `service_error: ${err?.message ?? 'unknown'} (${statusInfo})${body}`;
          
          console.error('[PlaceService] Final error after all attempts:', message);
          
          // Dernier recours : fallback
          if (fallbackData) {
            console.log(`[PlaceService] Using fallback after all attempts failed for ${normalizedCity}`);
            return fallbackData;
          }
          
          throw new Error(message);
        }
      }
    }

    // Si nous sortons de la boucle sans retourner, utiliser le fallback en dernier recours
    if (fallbackData) {
      console.log(`[PlaceService] Exhausted all attempts, using fallback for ${normalizedCity}`);
      return fallbackData;
    }

    // If we exit loop without returning, throw an informative error
    throw new Error(`service_error: ${lastErr?.message ?? 'unknown'}`);
  }
}
