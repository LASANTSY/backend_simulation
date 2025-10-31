"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const city_query_dto_1 = require("./dto/city-query.dto");
const place_service_1 = require("./place.service");
const router = express_1.default.Router();
const service = new place_service_1.PlaceService();
router.get('/places/bbox', async (req, res) => {
    const dto = (0, class_transformer_1.plainToInstance)(city_query_dto_1.CityQueryDto, req.query);
    const errors = await (0, class_validator_1.validate)(dto, { whitelist: true, forbidNonWhitelisted: false });
    if (errors.length > 0)
        return res.status(400).json({ errors });
    try {
        const bbox = await service.getCityBBox(dto.city);
        return res.json(bbox);
    }
    catch (err) {
        if ((err === null || err === void 0 ? void 0 : err.message) === 'not_found')
            return res.status(404).json({ message: 'City not found' });
        if ((err === null || err === void 0 ? void 0 : err.message) === 'timeout')
            return res.status(504).json({ message: 'OSM service timed out' });
        console.error('PlaceService error', err);
        return res.status(502).json({ message: 'Failed to fetch city bbox' });
    }
});
exports.default = router;
//# sourceMappingURL=place.controller.js.map