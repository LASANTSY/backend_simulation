"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const overpass_service_1 = require("./overpass.service");
const bbox_query_dto_1 = require("./dto/bbox-query.dto");
const stored_query_dto_1 = require("./dto/stored-query.dto");
const data_source_1 = __importDefault(require("../data-source"));
const marketplace_entity_1 = require("./marketplace.entity");
const place_service_1 = require("./place.service");
const router = express_1.default.Router();
const service = new overpass_service_1.OverpassService();
const placeService = new place_service_1.PlaceService();
router.get('/markets', async (req, res) => {
    const dto = (0, class_transformer_1.plainToInstance)(bbox_query_dto_1.BboxQueryDto, req.query);
    const errors = await (0, class_validator_1.validate)(dto, { whitelist: true, forbidNonWhitelisted: false });
    if (errors.length > 0)
        return res.status(400).json({ errors });
    try {
        const results = await service.fetchAndStoreMarkets(dto, dto.city);
        res.json(results);
    }
    catch (err) {
        console.error('Overpass fetch error', err);
        res.status(502).json({ message: 'Failed to fetch marketplaces', error: String(err) });
    }
});
router.get('/markets/stored', async (req, res) => {
    const dto = (0, class_transformer_1.plainToInstance)(stored_query_dto_1.StoredQueryDto, req.query);
    const errors = await (0, class_validator_1.validate)(dto, { whitelist: true, forbidNonWhitelisted: false });
    if (errors.length > 0)
        return res.status(400).json({ errors });
    try {
        const repo = data_source_1.default.getRepository(marketplace_entity_1.Marketplace);
        const qb = repo.createQueryBuilder('m');
        if (dto.city) {
            qb.andWhere('m.city = :city', { city: dto.city });
        }
        if (dto.since) {
            const sinceDate = new Date(dto.since);
            if (!isNaN(sinceDate.getTime()))
                qb.andWhere('m.fetched_at >= :since', { since: sinceDate.toISOString() });
        }
        if (dto.south !== undefined && dto.north !== undefined) {
            qb.andWhere('m.latitude >= :south AND m.latitude <= :north', { south: dto.south, north: dto.north });
        }
        if (dto.west !== undefined && dto.east !== undefined) {
            qb.andWhere('m.longitude >= :west AND m.longitude <= :east', { west: dto.west, east: dto.east });
        }
        if (dto.limit)
            qb.limit(dto.limit);
        const items = await qb.orderBy('m.fetched_at', 'DESC').getMany();
        res.json(items);
    }
    catch (err) {
        console.error('Error reading stored marketplaces', err);
        res.status(500).json({ message: 'Failed to read stored marketplaces', error: String(err) });
    }
});
router.get('/markets/normalized', async (req, res) => {
    const dto = (0, class_transformer_1.plainToInstance)(stored_query_dto_1.StoredQueryDto, req.query);
    const errors = await (0, class_validator_1.validate)(dto, { whitelist: true, forbidNonWhitelisted: false });
    if (errors.length > 0)
        return res.status(400).json({ errors });
    try {
        const repo = data_source_1.default.getRepository(marketplace_entity_1.Marketplace);
        const qb = repo.createQueryBuilder('m');
        if (dto.city)
            qb.andWhere('m.city = :city', { city: dto.city });
        if (dto.since) {
            const sinceDate = new Date(dto.since);
            if (!isNaN(sinceDate.getTime()))
                qb.andWhere('m.fetched_at >= :since', { since: sinceDate.toISOString() });
        }
        if (dto.south !== undefined && dto.north !== undefined)
            qb.andWhere('m.latitude >= :south AND m.latitude <= :north', { south: dto.south, north: dto.north });
        if (dto.west !== undefined && dto.east !== undefined)
            qb.andWhere('m.longitude >= :west AND m.longitude <= :east', { west: dto.west, east: dto.east });
        if (dto.limit)
            qb.limit(dto.limit);
        const items = await qb.orderBy('m.fetched_at', 'DESC').getMany();
        const delta = 0.0015;
        const normalized = items.map((it) => {
            var _a, _b;
            const lat = (_a = it.latitude) !== null && _a !== void 0 ? _a : 0;
            const lon = (_b = it.longitude) !== null && _b !== void 0 ? _b : 0;
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
    }
    catch (err) {
        console.error('Error building normalized marketplaces', err);
        res.status(500).json({ message: 'Failed to build normalized marketplaces', error: String(err) });
    }
});
router.get('/markets/by-city', async (req, res) => {
    const ville = req.query.ville || req.query.city;
    if (!ville)
        return res.status(400).json({ message: 'ville query parameter is required' });
    try {
        const bbox = await placeService.getCityBBox(ville);
        const fetched = await service.fetchAndStoreMarkets({ south: bbox.south, west: bbox.west, north: bbox.north, east: bbox.east }, ville);
        const features = fetched.map((it) => {
            const osmIdParts = it.osm_id ? it.osm_id.split(':') : ['', ''];
            const osmIdNumber = osmIdParts.length > 1 ? parseInt(osmIdParts[1], 10) : null;
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
    }
    catch (err) {
        console.error('markets/by-city error', err);
        if ((err === null || err === void 0 ? void 0 : err.message) === 'not_found')
            return res.status(404).json({ message: 'City not found' });
        if ((err === null || err === void 0 ? void 0 : err.message) === 'timeout')
            return res.status(504).json({ message: 'Provider timeout' });
        return res.status(502).json({ message: 'Failed to fetch markets for city', error: String(err) });
    }
});
exports.default = router;
//# sourceMappingURL=overpass.controller.js.map