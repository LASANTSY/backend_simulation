"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaceService = void 0;
const axios_1 = __importDefault(require("axios"));
const MADAGASCAR_CITIES_FALLBACK = {
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
const MADAGASCAR_BBOX_FALLBACK = {
    'Antananarivo': { south: -18.9792, west: 47.4079, north: -18.7792, east: 47.6079, display_name: 'Antananarivo, Madagascar' },
    'Toamasina': { south: -18.2443, west: 49.3122, north: -18.0443, east: 49.5122, display_name: 'Toamasina, Madagascar' },
    'Mahajanga': { south: -15.8167, west: 46.2167, north: -15.6167, east: 46.4167, display_name: 'Mahajanga, Madagascar' },
    'Antsohihy': { south: -14.9789, west: 47.8894, north: -14.7789, east: 48.0894, display_name: 'Antsohihy, Madagascar' },
    'Fianarantsoa': { south: -21.5427, west: 46.9857, north: -21.3427, east: 47.1857, display_name: 'Fianarantsoa, Madagascar' },
    'Toliara': { south: -23.4500, west: 43.5667, north: -23.2500, east: 43.7667, display_name: 'Toliara (Tuléar), Madagascar' },
    'Antsiranana': { south: -12.3787, west: 49.1917, north: -12.1787, east: 49.3917, display_name: 'Antsiranana (Diego-Suarez), Madagascar' },
};
class PlaceService {
    constructor() {
        this.endpoint = 'https://nominatim.openstreetmap.org/search';
        this.timeoutMs = 10000;
        this.lastRequestTime = 0;
        this.minRequestInterval = 1000;
        this.bboxCache = new Map();
        this.cacheTTL = 3600000;
    }
    async waitForRateLimit() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < this.minRequestInterval) {
            const waitTime = this.minRequestInterval - timeSinceLastRequest;
            console.log(`[PlaceService] Rate limiting: waiting ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        this.lastRequestTime = Date.now();
    }
    getHeaders() {
        return {
            'User-Agent': 'MobilisationRecetteLocale/1.0 (contact@mobilisation-recette-madagascar.mg)',
            'Referer': 'https://mobilisation-recette-locale.mg',
            'Accept-Language': 'fr,en',
        };
    }
    normalizeCityName(city) {
        return city.trim().replace(/\s+/g, ' ');
    }
    getCachedBBox(city) {
        const normalized = this.normalizeCityName(city);
        const cached = this.bboxCache.get(normalized);
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            console.log(`[PlaceService] Using cached bbox for ${normalized}`);
            return cached.bbox;
        }
        return null;
    }
    setCachedBBox(city, bbox) {
        const normalized = this.normalizeCityName(city);
        this.bboxCache.set(normalized, { bbox, timestamp: Date.now() });
    }
    classifyError(err, city) {
        var _a, _b, _c;
        if ((err === null || err === void 0 ? void 0 : err.code) === 'ECONNABORTED' || ((_a = err === null || err === void 0 ? void 0 : err.message) === null || _a === void 0 ? void 0 : _a.includes('timeout'))) {
            return {
                type: 'TIMEOUT',
                message: `Timeout lors de la géolocalisation de "${city}"`,
                canRetry: true,
            };
        }
        const status = (_b = err === null || err === void 0 ? void 0 : err.response) === null || _b === void 0 ? void 0 : _b.status;
        if (status === 403) {
            return {
                type: 'ACCESS_BLOCKED',
                message: 'Accès bloqué par Nominatim (vérifier User-Agent et respecter la policy)',
                statusCode: 403,
                details: (_c = err === null || err === void 0 ? void 0 : err.response) === null || _c === void 0 ? void 0 : _c.data,
                canRetry: false,
            };
        }
        if (status === 429) {
            return {
                type: 'RATE_LIMITED',
                message: 'Limite de fréquence dépassée (429 Too Many Requests)',
                statusCode: 429,
                canRetry: true,
            };
        }
        if (status && status >= 500) {
            return {
                type: 'SERVICE_UNAVAILABLE',
                message: `Service Nominatim indisponible (${status})`,
                statusCode: status,
                canRetry: true,
            };
        }
        if ((err === null || err === void 0 ? void 0 : err.code) === 'ENOTFOUND' || (err === null || err === void 0 ? void 0 : err.code) === 'ECONNREFUSED') {
            return {
                type: 'NETWORK_ERROR',
                message: `Erreur réseau : ${err.code}`,
                details: err === null || err === void 0 ? void 0 : err.message,
                canRetry: true,
            };
        }
        return {
            type: 'NETWORK_ERROR',
            message: (err === null || err === void 0 ? void 0 : err.message) || 'Erreur inconnue lors de la géolocalisation',
            details: err,
            canRetry: false,
        };
    }
    async getCityBBox(city) {
        const normalized = this.normalizeCityName(city);
        const cached = this.getCachedBBox(normalized);
        if (cached) {
            return { success: true, data: cached };
        }
        const fallback = MADAGASCAR_BBOX_FALLBACK[normalized];
        await this.waitForRateLimit();
        try {
            const resp = await axios_1.default.get(this.endpoint, {
                params: {
                    q: city,
                    format: 'json',
                    limit: 1,
                    countrycodes: 'mg',
                },
                timeout: this.timeoutMs,
                headers: this.getHeaders(),
            });
            const data = resp.data;
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
            const bbox = {
                south: parseFloat(bb[0]),
                north: parseFloat(bb[1]),
                west: parseFloat(bb[2]),
                east: parseFloat(bb[3]),
                display_name: first.display_name,
            };
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
        }
        catch (err) {
            const error = this.classifyError(err, city);
            console.error(`[PlaceService] Erreur lors de la géolocalisation de "${city}":`, {
                type: error.type,
                message: error.message,
                statusCode: error.statusCode,
            });
            if (fallback) {
                console.log(`[PlaceService] Utilisation du fallback après erreur ${error.type} pour "${normalized}"`);
                this.setCachedBBox(normalized, fallback);
                return { success: true, data: fallback };
            }
            return { success: false, error };
        }
    }
    async getCityInfo(city) {
        var _a, _b, _c, _d, _e, _f;
        const normalizedCity = city.trim();
        const fallbackData = MADAGASCAR_CITIES_FALLBACK[normalizedCity];
        if (fallbackData) {
            console.log(`[PlaceService] Using fallback coordinates for ${normalizedCity}`);
        }
        await this.waitForRateLimit();
        const maxAttempts = 3;
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        let lastErr = null;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const resp = await axios_1.default.get(this.endpoint, {
                    params: {
                        q: city,
                        format: 'json',
                        limit: 1,
                        addressdetails: 1,
                        countrycodes: 'mg',
                    },
                    timeout: this.timeoutMs,
                    headers: this.getHeaders(),
                });
                const data = resp.data;
                if (!Array.isArray(data) || data.length === 0) {
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
            }
            catch (err) {
                lastErr = err;
                if ((err === null || err === void 0 ? void 0 : err.message) === 'not_found') {
                    if (fallbackData) {
                        console.log(`[PlaceService] City not found in Nominatim, using fallback for ${normalizedCity}`);
                        return fallbackData;
                    }
                    throw err;
                }
                if ((err === null || err === void 0 ? void 0 : err.code) === 'ECONNABORTED') {
                    if (attempt === maxAttempts) {
                        console.error(`[PlaceService] Timeout after ${maxAttempts} attempts`);
                        if (fallbackData)
                            return fallbackData;
                        throw new Error('timeout');
                    }
                    await sleep(200 * attempt);
                    continue;
                }
                const status = (_a = err === null || err === void 0 ? void 0 : err.response) === null || _a === void 0 ? void 0 : _a.status;
                if (status === 403) {
                    const errorBody = (_b = err === null || err === void 0 ? void 0 : err.response) === null || _b === void 0 ? void 0 : _b.data;
                    console.error('[PlaceService] 403 Access Blocked by Nominatim:', {
                        city,
                        attempt,
                        body: typeof errorBody === 'string' ? errorBody.substring(0, 200) : errorBody,
                        headers: this.getHeaders(),
                    });
                    if (fallbackData) {
                        console.log(`[PlaceService] Using fallback after 403 error for ${normalizedCity}`);
                        return fallbackData;
                    }
                    throw new Error('service_error: Nominatim access blocked (403). ' +
                        'Verify User-Agent email is valid and rate limiting is respected. ' +
                        'See https://operations.osmfoundation.org/policies/nominatim/');
                }
                if ((status && (status >= 500 || status === 429)) && attempt < maxAttempts) {
                    console.warn(`[PlaceService] Retrying after status ${status} (attempt ${attempt}/${maxAttempts})...`);
                    await sleep(250 * attempt * (status === 429 ? 4 : 1));
                    continue;
                }
                if (attempt === maxAttempts) {
                    const statusInfo = status ? `status=${status}` : `code=${(_c = err === null || err === void 0 ? void 0 : err.code) !== null && _c !== void 0 ? _c : 'unknown'}`;
                    const body = ((_d = err === null || err === void 0 ? void 0 : err.response) === null || _d === void 0 ? void 0 : _d.data) ? ` body=${JSON.stringify(err.response.data).substring(0, 300)}` : '';
                    const message = `service_error: ${(_e = err === null || err === void 0 ? void 0 : err.message) !== null && _e !== void 0 ? _e : 'unknown'} (${statusInfo})${body}`;
                    console.error('[PlaceService] Final error after all attempts:', message);
                    if (fallbackData) {
                        console.log(`[PlaceService] Using fallback after all attempts failed for ${normalizedCity}`);
                        return fallbackData;
                    }
                    throw new Error(message);
                }
            }
        }
        if (fallbackData) {
            console.log(`[PlaceService] Exhausted all attempts, using fallback for ${normalizedCity}`);
            return fallbackData;
        }
        throw new Error(`service_error: ${(_f = lastErr === null || lastErr === void 0 ? void 0 : lastErr.message) !== null && _f !== void 0 ? _f : 'unknown'}`);
    }
}
exports.PlaceService = PlaceService;
//# sourceMappingURL=place.service.js.map