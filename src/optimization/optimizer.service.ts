import AppDataSource from '../data-source';
import simulationService from '../simulation/simulation.service';
import contextService from '../context/context.service';
import { AnalysisResult } from '../entities/AnalysisResult';
import { Simulation } from '../entities/Simulation';

/**
 * OptimizerService
 * - For a given simulation, evaluates candidate months in the simulation horizon
 *   and scores each month according to: seasonality, economic trend, weather favorability,
 *   historical patterns (baseline predictions), and returns the best date with confidence and justification.
 * - Persists the optimization result inside an AnalysisResult record (under resultData.optimization).
 */
export class OptimizerService {
  private analysisRepo = AppDataSource.getRepository(AnalysisResult);

  // Weights for scoring components (tweakable)
  private weights = {
    season: 0.25,
    economic: 0.25,
    weather: 0.2,
    historical: 0.2,
    predictionTrend: 0.1,
  };

  // Helper to estimate economic trend score: -1..1 mapped to 0..1
  scoreEconomicTrend(indicatorData: any): number {
    try {
      // world bank returns array [meta, data]. data is array with year values; compute last n-year growth average on indicator values
      const dataArr = Array.isArray(indicatorData) && indicatorData[1] ? indicatorData[1] : indicatorData;
      if (!Array.isArray(dataArr)) return 0.5;
      const vals = dataArr
        .map((d: any) => ({ year: d.date, value: Number(d.value) }))
        .filter((d: any) => !isNaN(d.value))
        .sort((a: any, b: any) => Number(a.year) - Number(b.year));
      if (vals.length < 2) return 0.5;
      // compute average annual growth rate over last up to 3 data points
      const last = vals.slice(-4);
      let growths: number[] = [];
      for (let i = 1; i < last.length; i++) {
        const prev = last[i - 1].value;
        const cur = last[i].value;
        if (!prev || !cur) continue;
        growths.push((cur - prev) / Math.abs(prev));
      }
      if (growths.length === 0) return 0.5;
      const avgGrowth = growths.reduce((s, v) => s + v, 0) / growths.length;
      // map: large positive -> near 1, negative -> near 0
      const score = 1 / (1 + Math.exp(-5 * (avgGrowth))); // sigmoid scaling
      return Number(score.toFixed(3));
    } catch (e) {
      return 0.5;
    }
  }

  // Weather favorability: simple heuristic using weather data: favorable if mild temperature and low precipitation
  scoreWeather(weatherData: any): number {
    try {
      const temp = weatherData?.main?.temp ?? null;
      const rain = (weatherData?.rain && (weatherData.rain['1h'] || weatherData.rain['3h'])) || 0;
      if (temp === null) return 0.5;
      // best temp ~15-25C
      const tempScore = 1 - Math.min(Math.abs(temp - 20) / 20, 1);
      const rainScore = rain > 0 ? Math.max(0, 1 - Math.log(1 + rain) / 3) : 1;
      const combined = 0.6 * tempScore + 0.4 * rainScore;
      return Number(Math.max(0, Math.min(1, combined)).toFixed(3));
    } catch (e) {
      return 0.5;
    }
  }

  // Seasonality: if simulation notes indicate seasonal advantage, prefer that season; otherwise detect historical seasonal pattern from baseline predictions
  scoreSeasonality(month: number, historicalMonthlySeries: number[], params: any): number {
    try {
      // month: 1..12
      if (params && params.seasonPreference) {
        // e.g., params.seasonPreference = ['summer']
        const pref = params.seasonPreference;
        const seasonOfMonth = (m: number) => (m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter');
        return pref.includes(seasonOfMonth(month)) ? 1 : 0.3;
      }

      // infer seasonality from historicalMonthlySeries: compute average per month of year across series
      if (!historicalMonthlySeries || historicalMonthlySeries.length === 0) return 0.5;
      // assume historicalMonthlySeries is array matching months in simulation horizon; to infer, we will fallback to 0.5
      // More advanced: compute average for same month across years; here approximate by comparing value to series median
      const median = [...historicalMonthlySeries].sort((a, b) => a - b)[Math.floor(historicalMonthlySeries.length / 2)];
      const monthIndex = 0; // lack of mapping -> neutral
      const val = historicalMonthlySeries[monthIndex] ?? median;
      const relative = median === 0 ? 0.5 : Math.max(0, Math.min(1, 0.5 + (val - median) / (Math.abs(median) + 1)));
      return Number(relative.toFixed(3));
    } catch (e) {
      return 0.5;
    }
  }

  // Historical pattern score: months with historically higher baseline prediction get higher score
  scoreHistorical(index: number, baselineSeries: number[]): number {
    try {
      if (!baselineSeries || baselineSeries.length === 0) return 0.5;
      const val = baselineSeries[index] ?? 0;
      const max = Math.max(...baselineSeries, 1);
      const score = val / max; // 0..1
      return Number(score.toFixed(3));
    } catch (e) {
      return 0.5;
    }
  }

  // Prediction trend score: compare predictedChange (if available) to boost/dampen score
  scorePredictionTrend(predictedDelta: number): number {
    try {
      if (predictedDelta === undefined || predictedDelta === null) return 0.5;
      // positive delta increases likelihood
      const s = 1 / (1 + Math.exp(-0.0005 * predictedDelta));
      return Number(s.toFixed(3));
    } catch (e) {
      return 0.5;
    }
  }

  // Main method: compute optimal month in simulation horizon
  async recommendTiming(simulationId: string) {
    // fetch simulation
    const simRepo = AppDataSource.getRepository(Simulation);
    const sim = await simRepo.findOneBy({ id: simulationId });
    if (!sim) throw new Error('Simulation not found');

    // derive months horizon
    const params = sim.parameters || {};
    const startDate = params.startDate ? new Date(params.startDate) : new Date();
    const duration = params.durationMonths ?? 12;
    const months: { date: string; year: number; month: number }[] = [];
    const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    for (let i = 0; i < duration; i++) {
      months.push({ date: `${cursor.getFullYear().toString().padStart(4, '0')}-${(cursor.getMonth() + 1).toString().padStart(2, '0')}-01`, year: cursor.getFullYear(), month: cursor.getMonth() + 1 });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    // fetch baseline predictions for the months
    const predRepo = AppDataSource.getRepository('Prediction' as any);
    const preds = await predRepo.find({ where: { period: 'monthly', predictedDate: months.map((m) => m.date) } });
    const baselineMap: Record<string, number> = {};
    for (const p of preds as any[]) baselineMap[p.predictedDate] = Number(p.predictedAmount || 0);
    const baselineSeries = months.map((m) => baselineMap[m.date] ?? 0);

    // fetch context
    const context = await contextService.fetchContextForSimulation(sim);

    // estimate economic score from available indicators (use GDP if present)
    let econScore = 0.5;
    if (context.economic && context.economic.gdp) econScore = this.scoreEconomicTrend(context.economic.gdp);

    // iterate months and compute composite score
    const monthScores: { date: string; score: number; breakdown: any }[] = [];
    for (let i = 0; i < months.length; i++) {
      const m = months[i];

      // season score
      const seasonScore = this.scoreSeasonality(m.month, baselineSeries, params);

      // weather: attempt to fetch weather forecast for that month start (approx using current weather as proxy)
      let weatherScore = 0.5;
      try {
        if (context.weather) {
          weatherScore = this.scoreWeather(context.weather);
        } else if (params.location && params.location.lat && params.location.lon) {
          const w = await contextService.fetchWeather(params.location.lat, params.location.lon, m.date);
          weatherScore = this.scoreWeather(w);
        }
      } catch (e) {
        weatherScore = 0.5;
      }

      const histScore = this.scoreHistorical(i, baselineSeries);

      // prediction trend: attempt to use predictionRepo entries flagged as 'linear_regression' for that date to compute predicted delta
      let predDelta = 0;
      try {
        const p = (await predRepo.findOne({ where: { predictedDate: m.date, model: 'linear_regression' } })) as any;
        if (p) predDelta = Number(p.predictedAmount || 0) - (baselineMap[m.date] ?? 0);
      } catch {}
      const predTrendScore = this.scorePredictionTrend(predDelta);

      // composite weighted score
      const score = seasonScore * this.weights.season + econScore * this.weights.economic + weatherScore * this.weights.weather + histScore * this.weights.historical + predTrendScore * this.weights.predictionTrend;

      monthScores.push({ date: m.date, score: Number(score.toFixed(4)), breakdown: { seasonScore, econScore, weatherScore, histScore, predTrendScore, predDelta } });
    }

    // choose best month (highest score)
    monthScores.sort((a, b) => b.score - a.score);
    const best = monthScores[0];

    // confidence: aggregate consistency across factors -> higher if many factors > 0.6 and data present
    const factors = Object.values(best.breakdown).filter((v: any) => typeof v === 'number') as number[];
    const positiveCount = factors.filter((v) => v >= 0.6).length;
    const confidence = Math.max(0.1, Math.min(0.99, 0.3 + (positiveCount / factors.length) * 0.7));

    // justification: summarize top contributing factors
    const sortedFactors = Object.entries(best.breakdown).sort((a: any, b: any) => Number(b[1]) - Number(a[1]));
    const topReasons = sortedFactors.slice(0, 3).map(([k, v]) => `${k}: ${Number(v).toFixed(2)}`);

    // persist as a new AnalysisResult linked to simulation
    const analysis = this.analysisRepo.create({ simulation: sim as any, resultData: { optimization: { bestDate: best.date, score: best.score, breakdown: best.breakdown, all: monthScores } }, summary: `Optimization recommended ${best.date} (score ${best.score.toFixed(2)})` } as any);
    const saved = await this.analysisRepo.save(analysis as any);

    return { recommendation: { date: best.date, score: best.score, confidence, justification: topReasons.join('; ') }, analysis: saved };
  }
}

export default new OptimizerService();
