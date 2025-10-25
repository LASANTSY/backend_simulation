"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const create_revenue_dto_1 = require("./dto/create-revenue.dto");
const update_revenue_dto_1 = require("./dto/update-revenue.dto");
const revenue_service_1 = require("./revenue.service");
const router = express_1.default.Router();
const service = new revenue_service_1.RevenueService();
router.get('/revenues', async (req, res) => {
    const municipalityId = req.query.municipalityId || undefined;
    const items = await service.findAll(municipalityId);
    res.json(items);
});
router.get('/revenues/:id', async (req, res) => {
    const id = req.params.id;
    const item = await service.findOne(id);
    if (!item)
        return res.status(404).json({ message: 'Revenue not found' });
    res.json(item);
});
router.post('/revenues', async (req, res) => {
    const dto = (0, class_transformer_1.plainToInstance)(create_revenue_dto_1.CreateRevenueDto, req.body);
    const errors = await (0, class_validator_1.validate)(dto, { whitelist: true, forbidNonWhitelisted: false });
    if (errors.length > 0)
        return res.status(400).json({ errors });
    const created = await service.create(req.body);
    res.status(201).json(created);
});
router.put('/revenues/:id', async (req, res) => {
    const id = req.params.id;
    const dto = (0, class_transformer_1.plainToInstance)(update_revenue_dto_1.UpdateRevenueDto, req.body);
    const errors = await (0, class_validator_1.validate)(dto, { whitelist: true, forbidNonWhitelisted: false });
    if (errors.length > 0)
        return res.status(400).json({ errors });
    const updated = await service.update(id, req.body);
    if (!updated)
        return res.status(404).json({ message: 'Revenue not found' });
    res.json(updated);
});
router.delete('/revenues/:id', async (req, res) => {
    const id = req.params.id;
    const ok = await service.remove(id);
    if (!ok)
        return res.status(404).json({ message: 'Revenue not found' });
    res.status(204).send();
});
exports.default = router;
//# sourceMappingURL=revenue.controller.js.map