"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OptimizerService = void 0;
const data_source_1 = __importDefault(require("../data-source"));
const context_service_1 = __importDefault(require("../context/context.service"));
const AnalysisResult_1 = require("../entities/AnalysisResult");
const Simulation_1 = require("../entities/Simulation");
class OptimizerService {
    constructor() {
        this.analysisRepo = data_source_1.default.getRepository(AnalysisResult_1.AnalysisResult);
        this.weights = {
            season: 0.25,
            economic: 0.25,
            weather: 0.2,
            historical: 0.2,
            predictionTrend: 0.1,
        };
    }
    scoreEconomicTrend(indicatorData) {
        try {
            const dataArr = Array.isArray(indicatorData) && indicatorData[1] ? indicatorData[1] : indicatorData;
            if (!Array.isArray(dataArr))
                return 0.5;
            const vals = dataArr
                .map((d) => ({ year: d.date, value: Number(d.value) }))
                .filter((d) => !isNaN(d.value))
                .sort((a, b) => Number(a.year) - Number(b.year));
            if (vals.length < 2)
                return 0.5;
            const last = vals.slice(-4);
            let growths = [];
            for (let i = 1; i < last.length; i++) {
                const prev = last[i - 1].value;
                const cur = last[i].value;
                if (!prev || !cur)
                    continue;
                growths.push((cur - prev) / Math.abs(prev));
            }
            if (growths.length === 0)
                return 0.5;
            const avgGrowth = growths.reduce((s, v) => s + v, 0) / growths.length;
            const score = 1 / (1 + Math.exp(-5 * (avgGrowth)));
            return Number(score.toFixed(3));
        }
        catch (e) {
            return 0.5;
        }
    }
    scoreWeather(weatherData) {
        var _a, _b;
        try {
            const temp = (_b = (_a = weatherData === null || weatherData === void 0 ? void 0 : weatherData.main) === null || _a === void 0 ? void 0 : _a.temp) !== null && _b !== void 0 ? _b : null;
            const rain = ((weatherData === null || weatherData === void 0 ? void 0 : weatherData.rain) && (weatherData.rain['1h'] || weatherData.rain['3h'])) || 0;
            if (temp === null)
                return 0.5;
            const tempScore = 1 - Math.min(Math.abs(temp - 20) / 20, 1);
            const rainScore = rain > 0 ? Math.max(0, 1 - Math.log(1 + rain) / 3) : 1;
            const combined = 0.6 * tempScore + 0.4 * rainScore;
            return Number(Math.max(0, Math.min(1, combined)).toFixed(3));
        }
        catch (e) {
            return 0.5;
        }
    }
    scoreSeasonality(month, historicalMonthlySeries, params) {
        var _a;
        try {
            if (params && params.seasonPreference) {
                const pref = params.seasonPreference;
                const seasonOfMonth = (m) => (m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter');
                return pref.includes(seasonOfMonth(month)) ? 1 : 0.3;
            }
            if (!historicalMonthlySeries || historicalMonthlySeries.length === 0)
                return 0.5;
            const median = [...historicalMonthlySeries].sort((a, b) => a - b)[Math.floor(historicalMonthlySeries.length / 2)];
            const monthIndex = 0;
            const val = (_a = historicalMonthlySeries[monthIndex]) !== null && _a !== void 0 ? _a : median;
            const relative = median === 0 ? 0.5 : Math.max(0, Math.min(1, 0.5 + (val - median) / (Math.abs(median) + 1)));
            return Number(relative.toFixed(3));
        }
        catch (e) {
            return 0.5;
        }
    }
    scoreHistorical(index, baselineSeries) {
        var _a;
        try {
            if (!baselineSeries || baselineSeries.length === 0)
                return 0.5;
            const val = (_a = baselineSeries[index]) !== null && _a !== void 0 ? _a : 0;
            const max = Math.max(...baselineSeries, 1);
            const score = val / max;
            return Number(score.toFixed(3));
        }
        catch (e) {
            return 0.5;
        }
    }
    scorePredictionTrend(predictedDelta) {
        try {
            if (predictedDelta === undefined || predictedDelta === null)
                return 0.5;
            const s = 1 / (1 + Math.exp(-0.0005 * predictedDelta));
            return Number(s.toFixed(3));
        }
        catch (e) {
            return 0.5;
        }
    }
    async recommendTiming(simulationId) {
        var _a, _b;
        const simRepo = data_source_1.default.getRepository(Simulation_1.Simulation);
        const sim = await simRepo.findOneBy({ id: simulationId });
        if (!sim)
            throw new Error('Simulation not found');
        const params = sim.parameters || {};
        const startDate = params.startDate ? new Date(params.startDate) : new Date();
        const duration = (_a = params.durationMonths) !== null && _a !== void 0 ? _a : 12;
        const months = [];
        const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        for (let i = 0; i < duration; i++) {
            months.push({ date: `${cursor.getFullYear().toString().padStart(4, '0')}-${(cursor.getMonth() + 1).toString().padStart(2, '0')}-01`, year: cursor.getFullYear(), month: cursor.getMonth() + 1 });
            cursor.setMonth(cursor.getMonth() + 1);
        }
        const predRepo = data_source_1.default.getRepository('Prediction');
        const preds = await predRepo.find({ where: { period: 'monthly', predictedDate: months.map((m) => m.date) } });
        const baselineMap = {};
        for (const p of preds)
            baselineMap[p.predictedDate] = Number(p.predictedAmount || 0);
        const baselineSeries = months.map((m) => { var _a; return (_a = baselineMap[m.date]) !== null && _a !== void 0 ? _a : 0; });
        const context = await context_service_1.default.fetchContextForSimulation(sim);
        let econScore = 0.5;
        if (context.economic && context.economic.gdp)
            econScore = this.scoreEconomicTrend(context.economic.gdp);
        const monthScores = [];
        for (let i = 0; i < months.length; i++) {
            const m = months[i];
            const seasonScore = this.scoreSeasonality(m.month, baselineSeries, params);
            let weatherScore = 0.5;
            try {
                if (context.weather) {
                    weatherScore = this.scoreWeather(context.weather);
                }
                else if (params.location && params.location.lat && params.location.lon) {
                    const w = await context_service_1.default.fetchWeather(params.location.lat, params.location.lon, m.date);
                    weatherScore = this.scoreWeather(w);
                }
            }
            catch (e) {
                weatherScore = 0.5;
            }
            const histScore = this.scoreHistorical(i, baselineSeries);
            let predDelta = 0;
            try {
                const p = (await predRepo.findOne({ where: { predictedDate: m.date, model: 'linear_regression' } }));
                if (p)
                    predDelta = Number(p.predictedAmount || 0) - ((_b = baselineMap[m.date]) !== null && _b !== void 0 ? _b : 0);
            }
            catch { }
            const predTrendScore = this.scorePredictionTrend(predDelta);
            const score = seasonScore * this.weights.season + econScore * this.weights.economic + weatherScore * this.weights.weather + histScore * this.weights.historical + predTrendScore * this.weights.predictionTrend;
            monthScores.push({ date: m.date, score: Number(score.toFixed(4)), breakdown: { seasonScore, econScore, weatherScore, histScore, predTrendScore, predDelta } });
        }
        monthScores.sort((a, b) => b.score - a.score);
        const best = monthScores[0];
        const factors = Object.values(best.breakdown).filter((v) => typeof v === 'number');
        const positiveCount = factors.filter((v) => v >= 0.6).length;
        const confidence = Math.max(0.1, Math.min(0.99, 0.3 + (positiveCount / factors.length) * 0.7));
        const sortedFactors = Object.entries(best.breakdown).sort((a, b) => Number(b[1]) - Number(a[1]));
        const topReasons = sortedFactors.slice(0, 3).map(([k, v]) => `${k}: ${Number(v).toFixed(2)}`);
        const analysis = this.analysisRepo.create({ simulation: sim, resultData: { optimization: { bestDate: best.date, score: best.score, breakdown: best.breakdown, all: monthScores } }, summary: `Optimization recommended ${best.date} (score ${best.score.toFixed(2)})` });
        const saved = await this.analysisRepo.save(analysis);
        return { recommendation: { date: best.date, score: best.score, confidence, justification: topReasons.join('; ') }, analysis: saved };
    }
}
exports.OptimizerService = OptimizerService;
exports.default = new OptimizerService();
//# sourceMappingURL=optimizer.service.js.map