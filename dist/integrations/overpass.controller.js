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
const router = express_1.default.Router();
const service = new overpass_service_1.OverpassService();
router.get('/markets', async (req, res) => {
    const dto = (0, class_transformer_1.plainToInstance)(bbox_query_dto_1.BboxQueryDto, req.query);
    const errors = await (0, class_validator_1.validate)(dto, { whitelist: true, forbidNonWhitelisted: false });
    if (errors.length > 0)
        return res.status(400).json({ errors });
    try {
        const results = await service.fetchAndStoreMarkets(dto);
        res.json(results);
    }
    catch (err) {
        console.error('Overpass fetch error', err);
        res.status(502).json({ message: 'Failed to fetch marketplaces', error: String(err) });
    }
});
exports.default = router;
//# sourceMappingURL=overpass.controller.js.map