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
const transaction_service_1 = __importDefault(require("../integrations/transaction.service"));
const router = express_1.default.Router();
router.post('/predictions/run', async (req, res) => {
    const dto = (0, class_transformer_1.plainToInstance)(prediction_run_dto_1.PredictionRunDto, req.body || {});
    const errors = await (0, class_validator_1.validate)(dto);
    if (errors.length > 0)
        return res.status(400).json({ errors });
    const months = Number(dto.months || 12);
    const years = Number(dto.years || 3);
    const municipalityId = dto.municipalityId;
    if (!municipalityId)
        return res.status(400).json({ message: 'municipalityId is required for public predictions' });
    try {
        const resp = await transaction_service_1.default.fetchTransactions(String(municipalityId));
        const data = resp && resp.data ? resp.data : [];
        const monthlyMap = {};
        const annualMap = {};
        for (const t of data) {
            const amt = parseFloat(t.amount || '0');
            const d = new Date(t.createdAt || t.updatedAt || Date.now());
            if (isNaN(amt))
                continue;
            const y = d.getFullYear();
            const m = (d.getMonth() + 1).toString().padStart(2, '0');
            const ym = `${y}-${m}`;
            monthlyMap[ym] = (monthlyMap[ym] || 0) + amt;
            annualMap[String(y)] = (annualMap[String(y)] || 0) + amt;
        }
        const monthlyKeys = Object.keys(monthlyMap).sort();
        const monthlySeries = monthlyKeys.map((k) => monthlyMap[k]);
        const annualKeys = Object.keys(annualMap).sort();
        const annualSeries = annualKeys.map((k) => annualMap[k]);
        const maWindow = 3;
        const maPreds = prediction_service_1.default.movingAveragePredict(monthlySeries.slice(), maWindow, months);
        const lrMonthly = prediction_service_1.default.linearRegressionPredict(monthlySeries.slice(), months);
        const monthlyPredictions = [];
        const lastMonthKey = monthlyKeys.length > 0 ? monthlyKeys[monthlyKeys.length - 1] : null;
        let lastY = lastMonthKey ? parseInt(lastMonthKey.split('-')[0], 10) : new Date().getFullYear();
        let lastM = lastMonthKey ? parseInt(lastMonthKey.split('-')[1], 10) : new Date().getMonth() + 1;
        for (let i = 0; i < months; i++) {
            lastM += 1;
            if (lastM > 12) {
                lastM = 1;
                lastY += 1;
            }
            const monthStr = `${lastY.toString().padStart(4, '0')}-${lastM.toString().padStart(2, '0')}-01`;
            monthlyPredictions.push({ predictedDate: monthStr, amount: maPreds[i], model: `moving_average_${maWindow}`, period: 'monthly', municipalityId });
            monthlyPredictions.push({ predictedDate: monthStr, amount: lrMonthly.preds[i], lower: lrMonthly.lower[i], upper: lrMonthly.upper[i], model: 'linear_regression', period: 'monthly', municipalityId });
        }
        const lrAnnual = prediction_service_1.default.linearRegressionPredict(annualSeries.slice(), years);
        const annualPredictions = [];
        let lastYear = annualKeys.length > 0 ? parseInt(annualKeys[annualKeys.length - 1], 10) : new Date().getFullYear();
        for (let i = 0; i < years; i++) {
            lastYear += 1;
            const yearStr = `${lastYear}-01-01`;
            annualPredictions.push({ predictedDate: yearStr, amount: lrAnnual.preds[i], lower: lrAnnual.lower[i], upper: lrAnnual.upper[i], model: 'linear_regression', period: 'annual', municipalityId });
        }
        const saved = await prediction_service_1.default.storePredictions([...monthlyPredictions, ...annualPredictions]);
        res.json({ ok: true, savedCount: Array.isArray(saved) ? saved.length : 0, sample: saved && saved.length ? saved[0] : null });
    }
    catch (err) {
        console.error('Public prediction error', err);
        res.status(500).json({ message: 'Prediction run failed', error: String(err) });
    }
});
exports.default = router;
//# sourceMappingURL=prediction.public.controller.js.map