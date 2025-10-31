"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PredictionService = void 0;
const data_source_1 = __importDefault(require("../data-source"));
const Revenue_1 = require("../entities/Revenue");
const Prediction_1 = require("../entities/Prediction");
class PredictionService {
    constructor() {
        this.revenueRepo = data_source_1.default.getRepository(Revenue_1.Revenue);
        this.predictionRepo = data_source_1.default.getRepository(Prediction_1.Prediction);
    }
    async findAll(municipalityId) {
        if (municipalityId) {
            return this.predictionRepo.find({ where: { municipalityId }, order: { predictedDate: 'ASC' } });
        }
        return this.predictionRepo.find({ order: { predictedDate: 'ASC' } });
    }
    async getMonthlySums() {
        const rows = await this.revenueRepo
            .createQueryBuilder('r')
            .select("to_char(r.date, 'YYYY-MM')", 'period')
            .addSelect('SUM(r.amount)::numeric', 'amount')
            .groupBy('period')
            .orderBy('period')
            .getRawMany();
        return rows.map((r) => ({ period: r.period, amount: parseFloat(r.amount) }));
    }
    async getAnnualSums() {
        const rows = await this.revenueRepo
            .createQueryBuilder('r')
            .select("to_char(r.date, 'YYYY')", 'period')
            .addSelect('SUM(r.amount)::numeric', 'amount')
            .groupBy('period')
            .orderBy('period')
            .getRawMany();
        return rows.map((r) => ({ period: r.period, amount: parseFloat(r.amount) }));
    }
    movingAveragePredict(series, windowSize, horizon) {
        const preds = [];
        const n = series.length;
        for (let h = 1; h <= horizon; h++) {
            const start = Math.max(0, n - windowSize);
            const window = series.slice(start, n);
            const avg = window.reduce((s, v) => s + v, 0) / (window.length || 1);
            preds.push(avg);
            series.push(avg);
        }
        return preds;
    }
    linearRegressionPredict(series, horizon, confidence = 0.95) {
        const n = series.length;
        if (n === 0)
            return { preds: [], lower: [], upper: [] };
        const x = [];
        for (let i = 0; i < n; i++)
            x.push(i);
        const meanX = x.reduce((s, v) => s + v, 0) / n;
        const meanY = series.reduce((s, v) => s + v, 0) / n;
        let num = 0;
        let den = 0;
        for (let i = 0; i < n; i++) {
            num += (x[i] - meanX) * (series[i] - meanY);
            den += (x[i] - meanX) * (x[i] - meanX);
        }
        const slope = den === 0 ? 0 : num / den;
        const intercept = meanY - slope * meanX;
        let ssRes = 0;
        for (let i = 0; i < n; i++) {
            const fit = intercept + slope * x[i];
            ssRes += (series[i] - fit) * (series[i] - fit);
        }
        const sigma2 = n > 2 ? ssRes / (n - 2) : 0;
        const s = Math.sqrt(sigma2);
        const sumSqX = den;
        const preds = [];
        const lower = [];
        const upper = [];
        const z = confidence === 0.95 ? 1.96 : 1.96;
        for (let h = 1; h <= horizon; h++) {
            const x0 = n - 1 + h;
            const yHat = intercept + slope * x0;
            const se = s * Math.sqrt(1 + 1 / n + ((x0 - meanX) * (x0 - meanX)) / (sumSqX || 1));
            const l = yHat - z * se;
            const u = yHat + z * se;
            preds.push(yHat);
            lower.push(l);
            upper.push(u);
        }
        return { preds, lower, upper };
    }
    async storePredictions(predictions) {
        const entities = predictions.map((p) => this.predictionRepo.create({
            predictedDate: p.predictedDate,
            predictedAmount: p.amount,
            lowerBound: p.lower,
            upperBound: p.upper,
            model: p.model,
            confidenceLevel: 0.95,
            period: p.period,
            municipalityId: p.municipalityId,
        }));
        return this.predictionRepo.save(entities);
    }
    async computeAndStoreMonthly(months = 12, maWindow = 3, municipalityId) {
        const monthly = await this.getMonthlySums();
        const amounts = monthly.map((m) => m.amount);
        const lastPeriod = monthly.length > 0 ? monthly[monthly.length - 1].period : null;
        const maSeries = amounts.slice();
        const maPreds = this.movingAveragePredict(maSeries, maWindow, months);
        const lrResult = this.linearRegressionPredict(amounts.slice(), months);
        const predictions = [];
        const [lastYear, lastMon] = lastPeriod ? lastPeriod.split('-').map((s) => parseInt(s, 10)) : [new Date().getFullYear(), new Date().getMonth() + 1];
        let y = lastYear;
        let m = lastMon;
        for (let i = 0; i < months; i++) {
            m += 1;
            if (m > 12) {
                m = 1;
                y += 1;
            }
            const monthStr = `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-01`;
            predictions.push({ predictedDate: monthStr, amount: maPreds[i], lower: undefined, upper: undefined, model: `moving_average_${maWindow}`, period: 'monthly', municipalityId });
            predictions.push({ predictedDate: monthStr, amount: lrResult.preds[i], lower: lrResult.lower[i], upper: lrResult.upper[i], model: 'linear_regression', period: 'monthly', municipalityId });
        }
        return this.storePredictions(predictions);
    }
    async computeAndStoreAnnual(years = 3, municipalityId) {
        const annual = await this.getAnnualSums();
        const amounts = annual.map((a) => a.amount);
        const lastPeriod = annual.length > 0 ? annual[annual.length - 1].period : null;
        const lrResult = this.linearRegressionPredict(amounts.slice(), years);
        const predictions = [];
        let y = lastPeriod ? parseInt(lastPeriod, 10) : new Date().getFullYear();
        for (let i = 0; i < years; i++) {
            y += 1;
            const yearStr = `${y}-01-01`;
            predictions.push({ predictedDate: yearStr, amount: lrResult.preds[i], lower: lrResult.lower[i], upper: lrResult.upper[i], model: 'linear_regression', period: 'annual', municipalityId });
        }
        return this.storePredictions(predictions);
    }
    async runAll(months = 12, years = 3) {
        await this.computeAndStoreMonthly(months);
        await this.computeAndStoreAnnual(years);
        return true;
    }
}
exports.PredictionService = PredictionService;
exports.default = new PredictionService();
//# sourceMappingURL=prediction.service.js.map