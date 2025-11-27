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
    if (!ville) {
        return res.status(400).json({
            error: 'MISSING_PARAMETER',
            message: 'Le paramètre "ville" est requis',
            example: '/serviceprediction/markets/by-city?ville=Mahajanga'
        });
    }
    try {
        const bboxResult = await placeService.getCityBBox(ville);
        if (!bboxResult.success) {
            const error = 'error' in bboxResult ? bboxResult.error : null;
            switch (error === null || error === void 0 ? void 0 : error.type) {
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
                        retryAfter: 60,
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
        try {
            const fetched = await service.fetchAndStoreMarkets({
                south: bbox.south,
                west: bbox.west,
                north: bbox.north,
                east: bbox.east
            }, ville);
            const delta = 0.0015;
            const normalized = fetched.map((it) => {
                var _a, _b;
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
                const lat = (_a = it.latitude) !== null && _a !== void 0 ? _a : 0;
                const lon = (_b = it.longitude) !== null && _b !== void 0 ? _b : 0;
                const coords = [
                    [lon - delta, lat - delta],
                    [lon + delta, lat - delta],
                    [lon + delta, lat + delta],
                    [lon - delta, lat + delta],
                    [lon - delta, lat - delta],
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
            return res.json(normalized);
        }
        catch (overpassError) {
            console.error('[OverpassController] Erreur Overpass API:', overpassError);
            return res.status(503).json({
                error: 'OVERPASS_API_ERROR',
                message: 'Erreur lors de la récupération des marchés depuis Overpass API',
                details: (overpassError === null || overpassError === void 0 ? void 0 : overpassError.message) || String(overpassError),
                ville: ville,
                bbox: bbox,
                suggestion: 'La ville a été géolocalisée mais la récupération des marchés a échoué',
                canRetry: true,
            });
        }
    }
    catch (err) {
        console.error('[OverpassController] Erreur non gérée dans /markets/by-city:', err);
        return res.status(500).json({
            error: 'INTERNAL_ERROR',
            message: 'Erreur interne lors du traitement de la requête',
            details: (err === null || err === void 0 ? void 0 : err.message) || String(err),
            canRetry: false,
        });
    }
});
exports.default = router;
//# sourceMappingURL=overpass.controller.js.map