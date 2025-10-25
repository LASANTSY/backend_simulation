"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const prediction_service_1 = __importDefault(require("./prediction.service"));
const prediction_run_dto_1 = require("./dto/prediction-run.dto");
const router = express_1.default.Router();
router.post('/predictions/run', async (req, res) => {
    const dto = (0, class_transformer_1.plainToInstance)(prediction_run_dto_1.PredictionRunDto, req.body || {});
    const errors = await (0, class_validator_1.validate)(dto);
    if (errors.length > 0)
        return res.status(400).json({ errors });
    const months = Number(dto.months || 12);
    const years = Number(dto.years || 3);
    try {
        await prediction_service_1.default.runAll(months, years);
        res.json({ ok: true });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Prediction failed', error: String(err) });
    }
});
router.get('/predictions', async (req, res) => {
    const municipalityId = req.query.municipalityId || undefined;
    const preds = await prediction_service_1.default.findAll(municipalityId);
    res.json(preds);
});
router.get('/predictions/:id', async (req, res) => {
    const id = req.params.id;
    const p = await prediction_service_1.default['predictionRepo'].findOneBy({ id });
    if (!p)
        return res.status(404).json({ message: 'Not found' });
    res.json(p);
});
exports.default = router;
//# sourceMappingURL=prediction.controller.js.map