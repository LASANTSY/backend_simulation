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
const router = express_1.default.Router();
const service = new overpass_service_1.OverpassService();
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
exports.default = router;
//# sourceMappingURL=overpass.controller.js.map