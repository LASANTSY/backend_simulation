"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const create_simulation_dto_1 = require("./dto/create-simulation.dto");
const simulation_service_1 = __importDefault(require("./simulation.service"));
const router = express_1.default.Router();
router.post('/simulations', async (req, res) => {
    const dto = (0, class_transformer_1.plainToInstance)(create_simulation_dto_1.CreateSimulationDto, req.body);
    const errors = await (0, class_validator_1.validate)(dto, { whitelist: true, forbidNonWhitelisted: false });
    if (errors.length > 0)
        return res.status(400).json({ errors });
    try {
        const result = await simulation_service_1.default.createAndRunSimulation({
            revenueId: dto.revenueId,
            newAmount: dto.newAmount,
            frequency: dto.frequency,
            durationMonths: dto.durationMonths,
            startDate: dto.startDate,
            note: dto.note,
            weatherContext: dto.weatherContext,
            economicContext: dto.economicContext,
            demographicContext: dto.demographicContext,
        });
        res.status(201).json(result);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Simulation failed', error: String(err) });
    }
});
router.get('/simulations', async (req, res) => {
    const municipalityId = req.query.municipalityId || undefined;
    const sims = await simulation_service_1.default.findAllSimulations(municipalityId);
    res.json(sims);
});
router.get('/simulations/:id', async (req, res) => {
    const id = req.params.id;
    const s = await simulation_service_1.default.findSimulation(id);
    if (!s)
        return res.status(404).json({ message: 'Not found' });
    res.json(s);
});
router.get('/analysis-results', async (_req, res) => {
    const repo = (await Promise.resolve().then(() => __importStar(require('../data-source')))).default.getRepository('AnalysisResult');
    const items = await repo.find({ order: { createdAt: 'DESC' } });
    res.json(items);
});
exports.default = router;
//# sourceMappingURL=simulation.controller.js.map