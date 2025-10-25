"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimulationService = void 0;
const data_source_1 = __importDefault(require("../../src/data-source"));
const Revenue_1 = require("../entities/Revenue");
const Simulation_1 = require("../entities/Simulation");
const AnalysisResult_1 = require("../entities/AnalysisResult");
const Prediction_1 = require("../entities/Prediction");
const ai_service_1 = __importDefault(require("../ai/ai.service"));
class SimulationService {
    constructor() {
        this.revenueRepo = data_source_1.default.getRepository(Revenue_1.Revenue);
        this.simulationRepo = data_source_1.default.getRepository(Simulation_1.Simulation);
        this.analysisRepo = data_source_1.default.getRepository(AnalysisResult_1.AnalysisResult);
        this.predictionRepo = data_source_1.default.getRepository(Prediction_1.Prediction);
    }
    async createAndRunSimulation(opts) {
        var _a, _b, _c;
        const revenue = await this.revenueRepo.findOneBy({ id: opts.revenueId });
        if (!revenue)
            throw new Error('Revenue not found');
        const sim = this.simulationRepo.create({
            parameters: {
                revenueId: opts.revenueId,
                originalAmount: Number(revenue.amount),
                newAmount: opts.newAmount,
                frequency: opts.frequency,
                durationMonths: opts.durationMonths,
                startDate: opts.startDate || new Date().toISOString().slice(0, 10),
                note: opts.note,
            },
            weatherContext: (_a = opts.weatherContext) !== null && _a !== void 0 ? _a : null,
            economicContext: (_b = opts.economicContext) !== null && _b !== void 0 ? _b : null,
            demographicContext: (_c = opts.demographicContext) !== null && _c !== void 0 ? _c : null,
            status: 'running',
        });
        const savedSim = await this.simulationRepo.save(sim);
        const start = opts.startDate ? new Date(opts.startDate) : new Date();
        const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
        const months = [];
        for (let i = 0; i < opts.durationMonths; i++) {
            const y = cursor.getFullYear();
            const m = cursor.getMonth() + 1;
            months.push(`${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-01`);
            cursor.setMonth(cursor.getMonth() + 1);
        }
        const baselinePreds = await this.predictionRepo
            .createQueryBuilder('p')
            .where('p.period = :period', { period: 'monthly' })
            .andWhere('p.predictedDate IN (:...months)', { months })
            .orderBy('p.predictedDate', 'ASC')
            .getMany();
        const baselineMap = {};
        for (const d of baselinePreds)
            baselineMap[d.predictedDate] = Number(d.predictedAmount || 0);
        const baselineSeries = months.map((md) => { var _a; return (_a = baselineMap[md]) !== null && _a !== void 0 ? _a : 0; });
        const baselineTotal = baselineSeries.reduce((s, v) => s + v, 0);
        const originalAmount = Number(revenue.amount || 0);
        const deltaPerOccurrence = opts.newAmount - originalAmount;
        const simulatedSeries = baselineSeries.slice();
        if (opts.frequency === 'monthly') {
            for (let i = 0; i < months.length; i++)
                simulatedSeries[i] = simulatedSeries[i] + deltaPerOccurrence;
        }
        else if (opts.frequency === 'annual') {
            for (let i = 0; i < months.length; i++) {
                if (i % 12 === 0)
                    simulatedSeries[i] = simulatedSeries[i] + deltaPerOccurrence;
            }
        }
        const simulatedTotal = simulatedSeries.reduce((s, v) => s + v, 0);
        const deltaTotal = simulatedTotal - baselineTotal;
        const percentChange = baselineTotal === 0 ? null : (deltaTotal / baselineTotal) * 100;
        const riskLevel = deltaTotal < 0 ? 'negative' : deltaTotal > 0 ? 'positive' : 'neutral';
        const analysis = this.analysisRepo.create({
            simulation: savedSim,
            resultData: {
                months,
                baselineSeries,
                simulatedSeries,
                baselineTotal,
                simulatedTotal,
                deltaTotal,
                percentChange,
            },
            summary: `${riskLevel} impact: ${deltaTotal.toFixed(2)} (${percentChange ? percentChange.toFixed(2) + '%' : 'N/A'})`,
        });
        const savedAnalysis = await this.analysisRepo.save(analysis);
        const season = (() => {
            const d = new Date(opts.startDate || new Date().toISOString().slice(0, 10));
            const month = d.getMonth() + 1;
            return month >= 3 && month <= 5 ? 'spring' : month >= 6 && month <= 8 ? 'summer' : month >= 9 && month <= 11 ? 'autumn' : 'winter';
        })();
        const timeTrend = {
            percentChange,
            baselineTotal,
            simulatedTotal,
        };
        const extraContext = {
            time: { period: opts.durationMonths, season, trend: timeTrend },
            weather: opts.weatherContext || savedSim.weatherContext || null,
            economy: opts.economicContext || savedSim.economicContext || null,
            demography: opts.demographicContext || savedSim.demographicContext || null,
            months,
            baselineSeries,
            simulatedSeries,
        };
        try {
            await ai_service_1.default.enrichAnalysis(savedAnalysis.id, extraContext);
            const enriched = await this.analysisRepo.findOne({ where: { id: savedAnalysis.id }, relations: ['simulation'] });
            savedSim.status = 'completed';
            await this.simulationRepo.save(savedSim);
            return { simulation: savedSim, analysis: enriched };
        }
        catch (e) {
            savedSim.status = 'completed';
            await this.simulationRepo.save(savedSim);
            return { simulation: savedSim, analysis: savedAnalysis, aiError: String(e) };
        }
    }
    async findAllSimulations(municipalityId) {
        if (municipalityId) {
            return this.simulationRepo.find({ where: { municipalityId }, order: { createdAt: 'DESC' } });
        }
        return this.simulationRepo.find({ order: { createdAt: 'DESC' } });
    }
    async findSimulation(id) {
        return this.simulationRepo.findOneBy({ id });
    }
}
exports.SimulationService = SimulationService;
exports.default = new SimulationService();
//# sourceMappingURL=simulation.service.js.map