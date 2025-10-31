import express, { Request, Response } from 'express';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { OverpassService } from './overpass.service';
import { BboxQueryDto } from './dto/bbox-query.dto';
import { StoredQueryDto } from './dto/stored-query.dto';
import AppDataSource from '../data-source';
import { Marketplace } from './marketplace.entity';
import { PlaceService } from './place.service';

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
  if (!ville) return res.status(400).json({ message: 'ville query parameter is required' });

  try {
    // 1) get bbox for the city
    const bbox = await placeService.getCityBBox(ville);

    // 2) fetch markets and store them, passing provided city
    const fetched = await service.fetchAndStoreMarkets({ south: bbox.south, west: bbox.west, north: bbox.north, east: bbox.east }, ville);

    // 3) Build GeoJSON Feature Collection with real OSM geometries
    const features = fetched.map((it) => {
      // Extract OSM ID number from "type:id" format
      const osmIdParts = it.osm_id ? it.osm_id.split(':') : ['', ''];
      const osmIdNumber = osmIdParts.length > 1 ? parseInt(osmIdParts[1], 10) : null;

      // Use stored geometry if available, otherwise fallback to Point from lat/lon
      let geometry = it.geometry;
      if (!geometry && it.latitude != null && it.longitude != null) {
        geometry = {
          type: 'Point',
          coordinates: [it.longitude, it.latitude],
        };
      }

      return {
        type: 'Feature',
        properties: {
          id: osmIdNumber,
          name: it.name || 'Marché sans nom',
          amenity: 'marketplace',
          ville: it.city || ville,
          source: 'OpenStreetMap',
          osm_id: it.osm_id,
          note: 'Coordonnées extraites via Overpass API',
          tags: it.tags || {},
        },
        geometry: geometry || {
          type: 'Point',
          coordinates: [0, 0],
        },
      };
    });

    res.json(features);
  } catch (err: any) {
    console.error('markets/by-city error', err);
    if (err?.message === 'not_found') return res.status(404).json({ message: 'City not found' });
    if (err?.message === 'timeout') return res.status(504).json({ message: 'Provider timeout' });
    return res.status(502).json({ message: 'Failed to fetch markets for city', error: String(err) });
  }
});

export default router;

