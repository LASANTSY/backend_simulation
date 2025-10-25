import AppDataSource from '../../src/data-source';
import { Revenue } from '../entities/Revenue';
import { Simulation } from '../entities/Simulation';
import { AnalysisResult } from '../entities/AnalysisResult';
import { Prediction } from '../entities/Prediction';
import aiService from '../ai/ai.service';

export class SimulationService {
  private revenueRepo = AppDataSource.getRepository(Revenue);
  private simulationRepo = AppDataSource.getRepository(Simulation);
  private analysisRepo = AppDataSource.getRepository(AnalysisResult);
  private predictionRepo = AppDataSource.getRepository(Prediction);

  /**
   * Assumptions:
   * - A `Revenue` record contains a historical amount. For simulation we treat it as a recurring item
   *   that can be adjusted (frequency + duration).
   * - We compare against already-stored monthly baseline predictions in `prediction` table (period='monthly').
   * - durationMonths indicates how many months forward the simulation applies.
   */
  async createAndRunSimulation(opts: {
    revenueId: string;
    newAmount: number;
    frequency: 'monthly' | 'annual';
    durationMonths: number;
    startDate?: string; // ISO date
    note?: string;
    weatherContext?: any;
    economicContext?: any;
    demographicContext?: any;
  }) {
    const revenue = await this.revenueRepo.findOneBy({ id: opts.revenueId });
    if (!revenue) throw new Error('Revenue not found');

    // create simulation record
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
      weatherContext: opts.weatherContext ?? null,
      economicContext: opts.economicContext ?? null,
      demographicContext: opts.demographicContext ?? null,
      status: 'running',
    } as any);

    const savedSim = await this.simulationRepo.save(sim as any);

    // prepare horizon months list starting from startDate
    const start = opts.startDate ? new Date(opts.startDate) : new Date();
    // normalize to first day of month
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);

    const months: string[] = [];
    for (let i = 0; i < opts.durationMonths; i++) {
      const y = cursor.getFullYear();
      const m = cursor.getMonth() + 1;
      months.push(`${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-01`);
      cursor.setMonth(cursor.getMonth() + 1);
    }

    // fetch baseline predictions for these months (sum predictedAmount)
    const baselinePreds = await this.predictionRepo
      .createQueryBuilder('p')
      .where('p.period = :period', { period: 'monthly' })
      .andWhere('p.predictedDate IN (:...months)', { months })
      .orderBy('p.predictedDate', 'ASC')
      .getMany();

    // If some months missing baseline predictions, fall back to 0 for those months
    const baselineMap: Record<string, number> = {};
    for (const d of baselinePreds) baselineMap[(d as any).predictedDate] = Number(d.predictedAmount || 0);

    const baselineSeries = months.map((md) => baselineMap[md] ?? 0);
    const baselineTotal = baselineSeries.reduce((s, v) => s + v, 0);

    // Compute simulated series: apply delta for months depending on frequency
    const originalAmount = Number(revenue.amount || 0);
    const deltaPerOccurrence = opts.newAmount - originalAmount;

    const simulatedSeries = baselineSeries.slice(); // start from baseline

    if (opts.frequency === 'monthly') {
      for (let i = 0; i < months.length; i++) simulatedSeries[i] = simulatedSeries[i] + deltaPerOccurrence;
    } else if (opts.frequency === 'annual') {
      // apply once per 12 months starting at start
      for (let i = 0; i < months.length; i++) {
        if (i % 12 === 0) simulatedSeries[i] = simulatedSeries[i] + deltaPerOccurrence;
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
    } as any);

    const savedAnalysis = await this.analysisRepo.save(analysis as any);

    // Build extraContext for AI enrichment
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

    // Enrich analysis with AI synchronously (in same flow) and attach result to analysis
    try {
      await aiService.enrichAnalysis((savedAnalysis as any).id, extraContext);
      // reload updated analysis
      const enriched = await this.analysisRepo.findOne({ where: { id: (savedAnalysis as any).id }, relations: ['simulation'] });
      // mark simulation completed
      savedSim.status = 'completed';
      await this.simulationRepo.save(savedSim as any);

      return { simulation: savedSim, analysis: enriched };
    } catch (e) {
      // If AI enrichment fails, still mark simulation completed and return base analysis + error
      savedSim.status = 'completed';
      await this.simulationRepo.save(savedSim as any);
      return { simulation: savedSim, analysis: savedAnalysis, aiError: String(e) };
    }
  }

  async findAllSimulations() {
    return this.simulationRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findSimulation(id: string) {
    return this.simulationRepo.findOneBy({ id });
  }
}

export default new SimulationService();
