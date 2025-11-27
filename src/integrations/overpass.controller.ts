import express, { Request, Response } from 'express';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { OverpassService } from './overpass.service';
import { BboxQueryDto } from './dto/bbox-query.dto';
import { StoredQueryDto } from './dto/stored-query.dto';
import AppDataSource from '../data-source';
import { Marketplace } from './marketplace.entity';
import { PlaceService, GeocodingResult, CityBBox } from './place.service';

const router = express.Router();
const service = new OverpassService();
const placeService = new PlaceService();

// GET /markets?south=...&west=...&north=...&east=...
router.get('/markets', async (req: Request, res: Response) => {
  const dto = plainToInstance(BboxQueryDto, req.query);
  const errors = await validate(dto as any, { whitelist: true, forbidNonWhitelisted: false });
  if (errors.length > 0) return res.status(400).json({ errors });

  try {
    const results = await service.fetchAndStoreMarkets(dto as any, (dto as any).city);
    res.json(results);
  } catch (err: any) {
    console.error('Overpass fetch error', err);
    res.status(502).json({ message: 'Failed to fetch marketplaces', error: String(err) });
  }
});

// GET /markets/stored - return previously fetched marketplaces from local DB
router.get('/markets/stored', async (req: Request, res: Response) => {
  const dto = plainToInstance(StoredQueryDto, req.query);
  const errors = await validate(dto as any, { whitelist: true, forbidNonWhitelisted: false });
  if (errors.length > 0) return res.status(400).json({ errors });

  try {
    const repo = AppDataSource.getRepository(Marketplace);
    const qb = repo.createQueryBuilder('m');

    if (dto.city) {
      qb.andWhere('m.city = :city', { city: dto.city });
    }

    if (dto.since) {
      const sinceDate = new Date(dto.since);
      if (!isNaN(sinceDate.getTime())) qb.andWhere('m.fetched_at >= :since', { since: sinceDate.toISOString() });
    }

    // bbox filter (latitude/longitude between bounds)
    if (dto.south !== undefined && dto.north !== undefined) {
      qb.andWhere('m.latitude >= :south AND m.latitude <= :north', { south: dto.south, north: dto.north });
    }
    if (dto.west !== undefined && dto.east !== undefined) {
      qb.andWhere('m.longitude >= :west AND m.longitude <= :east', { west: dto.west, east: dto.east });
    }

    if (dto.limit) qb.limit(dto.limit);

    const items = await qb.orderBy('m.fetched_at', 'DESC').getMany();
    res.json(items);
  } catch (err: any) {
    console.error('Error reading stored marketplaces', err);
    res.status(500).json({ message: 'Failed to read stored marketplaces', error: String(err) });
  }
});

// GET /markets/normalized - normalized display for marketplaces
router.get('/markets/normalized', async (req: Request, res: Response) => {
  const dto = plainToInstance(StoredQueryDto, req.query);
  const errors = await validate(dto as any, { whitelist: true, forbidNonWhitelisted: false });
  if (errors.length > 0) return res.status(400).json({ errors });

  try {
    const repo = AppDataSource.getRepository(Marketplace);
    const qb = repo.createQueryBuilder('m');

    if (dto.city) qb.andWhere('m.city = :city', { city: dto.city });
    if (dto.since) {
      const sinceDate = new Date(dto.since);
      if (!isNaN(sinceDate.getTime())) qb.andWhere('m.fetched_at >= :since', { since: sinceDate.toISOString() });
    }
    if (dto.south !== undefined && dto.north !== undefined) qb.andWhere('m.latitude >= :south AND m.latitude <= :north', { south: dto.south, north: dto.north });
    if (dto.west !== undefined && dto.east !== undefined) qb.andWhere('m.longitude >= :west AND m.longitude <= :east', { west: dto.west, east: dto.east });
    if (dto.limit) qb.limit(dto.limit);

    const items = await qb.orderBy('m.fetched_at', 'DESC').getMany();

    // Produce normalized display: nom, ville, delimitation (Polygon)
    // For items without polygon geometry we create a small square around the centroid.
    const delta = 0.0015; // ~150m, adjustable

    const normalized = items.map((it) => {
      const lat = it.latitude ?? 0;
      const lon = it.longitude ?? 0;
      // Build square polygon (lon, lat) order
      const coords = [
        [lon - delta, lat - delta],
        [lon - delta, lat + delta],
        [lon + delta, lat + delta],
        [lon + delta, lat - delta],
        [lon - delta, lat - delta],
      ];

      return {
        nom: it.name || it.osm_id,
        ville: it.city || null,
        delimitation: {
          type: 'Polygon',
          coordinates: [coords],
        },
      };
    });

    res.json(normalized);
  } catch (err: any) {
    console.error('Error building normalized marketplaces', err);
    res.status(500).json({ message: 'Failed to build normalized marketplaces', error: String(err) });
  }
});

// GET /markets/by-city?ville=...  -> composite: places/bbox then markets then normalized
router.get('/markets/by-city', async (req: Request, res: Response) => {
  const ville = (req.query.ville as string) || (req.query.city as string);
  if (!ville) {
    return res.status(400).json({ 
      error: 'MISSING_PARAMETER',
      message: 'Le paramètre "ville" est requis',
      example: '/serviceprediction/markets/by-city?ville=Mahajanga'
    });
  }

  try {
    // 1) Récupérer la bbox pour la ville avec gestion d'erreurs robuste
    const bboxResult: GeocodingResult<CityBBox> = await placeService.getCityBBox(ville);

    // Gérer les erreurs de géolocalisation avec des codes HTTP appropriés
    if (!bboxResult.success) {
      const error = 'error' in bboxResult ? bboxResult.error : null;

      switch (error?.type) {
        case 'NOT_FOUND':
          return res.status(404).json({
            error: 'CITY_NOT_FOUND',
            message: `La ville "${ville}" n'a pas été trouvée dans Nominatim`,
            suggestion: 'Vérifiez l\'orthographe ou essayez une ville proche',
            canRetry: false,
          });

        case 'ACCESS_BLOCKED':
          return res.status(403).json({
            error: 'GEOCODING_BLOCKED',
            message: 'Accès bloqué par le service de géolocalisation',
            reason: 'Configuration User-Agent invalide ou politique d\'utilisation non respectée',
            details: 'Veuillez contacter l\'administrateur système',
            canRetry: false,
          });

        case 'RATE_LIMITED':
          return res.status(429).json({
            error: 'RATE_LIMIT_EXCEEDED',
            message: 'Limite de fréquence dépassée pour le service de géolocalisation',
            suggestion: 'Veuillez réessayer dans quelques secondes',
            canRetry: true,
            retryAfter: 60, // secondes
          });

        case 'SERVICE_UNAVAILABLE':
          return res.status(503).json({
            error: 'GEOCODING_SERVICE_UNAVAILABLE',
            message: 'Le service de géolocalisation est temporairement indisponible',
            statusCode: error.statusCode,
            suggestion: 'Veuillez réessayer ultérieurement',
            canRetry: true,
          });

        case 'TIMEOUT':
          return res.status(504).json({
            error: 'GEOCODING_TIMEOUT',
            message: 'Délai d\'attente dépassé lors de la géolocalisation',
            suggestion: 'Le service de géolocalisation ne répond pas, veuillez réessayer',
            canRetry: true,
          });

        case 'INVALID_RESPONSE':
          return res.status(502).json({
            error: 'INVALID_GEOCODING_RESPONSE',
            message: 'Réponse invalide du service de géolocalisation',
            details: error.message,
            canRetry: true,
          });

        case 'NETWORK_ERROR':
        default:
          return res.status(503).json({
            error: 'GEOCODING_NETWORK_ERROR',
            message: 'Erreur réseau lors de la géolocalisation',
            details: error.message,
            canRetry: error.canRetry,
          });
      }
    }

    const bbox = bboxResult.data;

    // 2) Récupérer les marchés via Overpass API
    try {
      const fetched = await service.fetchAndStoreMarkets(
        { 
          south: bbox.south, 
          west: bbox.west, 
          north: bbox.north, 
          east: bbox.east 
        }, 
        ville
      );

      // 3) Construire la réponse au format simplifié: { nom, ville, delimitation }
      const delta = 0.0015; // ~150m pour créer un polygone autour du point
      
      const normalized = fetched.map((it) => {
        // Si le marché a une géométrie Polygon, l'utiliser directement
        if (it.geometry && it.geometry.type === 'Polygon') {
          return {
            nom: it.name || 'Marché sans nom',
            ville: it.city || ville,
            delimitation: {
              type: 'Polygon',
              coordinates: it.geometry.coordinates,
            },
          };
        }

        // Sinon, créer un petit carré autour du point central
        const lat = it.latitude ?? 0;
        const lon = it.longitude ?? 0;
        const coords = [
          [lon - delta, lat - delta],
          [lon + delta, lat - delta],
          [lon + delta, lat + delta],
          [lon - delta, lat + delta],
          [lon - delta, lat - delta], // Fermer le polygone
        ];

        return {
          nom: it.name || 'Marché sans nom',
          ville: it.city || ville,
          delimitation: {
            type: 'Polygon',
            coordinates: [coords],
          },
        };
      });

      // Réponse réussie au format simplifié
      return res.json(normalized);

    } catch (overpassError: any) {
      // Erreur spécifique à Overpass API
      console.error('[OverpassController] Erreur Overpass API:', overpassError);
      
      return res.status(503).json({
        error: 'OVERPASS_API_ERROR',
        message: 'Erreur lors de la récupération des marchés depuis Overpass API',
        details: overpassError?.message || String(overpassError),
        ville: ville,
        bbox: bbox,
        suggestion: 'La ville a été géolocalisée mais la récupération des marchés a échoué',
        canRetry: true,
      });
    }

  } catch (err: any) {
    // Erreur non gérée (cas imprévu)
    console.error('[OverpassController] Erreur non gérée dans /markets/by-city:', err);
    
    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Erreur interne lors du traitement de la requête',
      details: err?.message || String(err),
      canRetry: false,
    });
  }
});

export default router;

