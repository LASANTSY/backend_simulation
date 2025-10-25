import AppDataSource from '../data-source';
import { Revenue } from '../entities/Revenue';
import { Prediction } from '../entities/Prediction';
import { Between } from 'typeorm';

export class PredictionService {
  private revenueRepo = AppDataSource.getRepository(Revenue);
  private predictionRepo = AppDataSource.getRepository(Prediction);

  // Helper: aggregate revenues by month (YYYY-MM) and return array of { period: 'YYYY-MM', amount }
  async getMonthlySums(): Promise<{ period: string; amount: number }[]> {
    const rows = await this.revenueRepo
      .createQueryBuilder('r')
      .select("to_char(r.date, 'YYYY-MM')", 'period')
      .addSelect('SUM(r.amount)::numeric', 'amount')
      .groupBy('period')
      .orderBy('period')
      .getRawMany();

    return rows.map((r: any) => ({ period: r.period, amount: parseFloat(r.amount) }));
  }

  // Helper: aggregate revenues by year (YYYY)
  async getAnnualSums(): Promise<{ period: string; amount: number }[]> {
    const rows = await this.revenueRepo
      .createQueryBuilder('r')
      .select("to_char(r.date, 'YYYY')", 'period')
      .addSelect('SUM(r.amount)::numeric', 'amount')
      .groupBy('period')
      .orderBy('period')
      .getRawMany();

    return rows.map((r: any) => ({ period: r.period, amount: parseFloat(r.amount) }));
  }

  // Simple moving average forecast
  movingAveragePredict(series: number[], windowSize: number, horizon: number): number[] {
    const preds: number[] = [];
    const n = series.length;
    for (let h = 1; h <= horizon; h++) {
      const start = Math.max(0, n - windowSize);
      const window = series.slice(start, n);
      const avg = window.reduce((s, v) => s + v, 0) / (window.length || 1);
      preds.push(avg);
      // append predicted to series for rolling predictions
      series.push(avg);
    }
    return preds;
  }

  // Simple linear regression (x = 0..n-1) and predict next horizon points with 95% CI
  linearRegressionPredict(series: number[], horizon: number, confidence = 0.95): { preds: number[]; lower: number[]; upper: number[] } {
    const n = series.length;
    if (n === 0) return { preds: [], lower: [], upper: [] };

    const x: number[] = [];
    for (let i = 0; i < n; i++) x.push(i);

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

    // residuals and estimate of variance
    let ssRes = 0;
    for (let i = 0; i < n; i++) {
      const fit = intercept + slope * x[i];
      ssRes += (series[i] - fit) * (series[i] - fit);
    }
    const sigma2 = n > 2 ? ssRes / (n - 2) : 0;
    const s = Math.sqrt(sigma2);

    const sumSqX = den; // sum (xi-meanX)^2

    const preds: number[] = [];
    const lower: number[] = [];
    const upper: number[] = [];

    // z for large-sample approx; for 95% use 1.96
    const z = confidence === 0.95 ? 1.96 : 1.96;

    for (let h = 1; h <= horizon; h++) {
      const x0 = n - 1 + h; // continuing index
      const yHat = intercept + slope * x0;
      // standard error of prediction
      const se = s * Math.sqrt(1 + 1 / n + ((x0 - meanX) * (x0 - meanX)) / (sumSqX || 1));
      const l = yHat - z * se;
      const u = yHat + z * se;
      preds.push(yHat);
      lower.push(l);
      upper.push(u);
    }

    return { preds, lower, upper };
  }

  // Create and persist predictions to DB
  async storePredictions(predictions: { predictedDate: string; amount: number; lower?: number; upper?: number; model?: string; period?: string }[]) {
    const entities = predictions.map((p) =>
      this.predictionRepo.create({
        predictedDate: p.predictedDate,
        predictedAmount: p.amount,
        lowerBound: p.lower,
        upperBound: p.upper,
        model: p.model,
        confidenceLevel: 0.95,
        period: p.period,
        municipalityId: (p as any).municipalityId,
      } as any),
    );
    return this.predictionRepo.save(entities as any);
  }

  // Compute monthly predictions for next `months` months, using both methods and persist
  async computeAndStoreMonthly(months = 12, maWindow = 3, municipalityId?: string) {
    const monthly = await this.getMonthlySums();
    const amounts = monthly.map((m) => m.amount);
    const lastPeriod = monthly.length > 0 ? monthly[monthly.length - 1].period : null; // 'YYYY-MM'

    // moving average
    const maSeries = amounts.slice();
    const maPreds = this.movingAveragePredict(maSeries, maWindow, months);

    // linear regression
    const lrResult = this.linearRegressionPredict(amounts.slice(), months);

    // build predicted dates
    const predictions: any[] = [];
    const [lastYear, lastMon] = lastPeriod ? lastPeriod.split('-').map((s: string) => parseInt(s, 10)) : [new Date().getFullYear(), new Date().getMonth() + 1];
    let y = lastYear;
    let m = lastMon;
    for (let i = 0; i < months; i++) {
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
      const monthStr = `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-01`;
      // store both MA and LR results
      predictions.push({ predictedDate: monthStr, amount: maPreds[i], lower: undefined, upper: undefined, model: `moving_average_${maWindow}`, period: 'monthly', municipalityId });
      predictions.push({ predictedDate: monthStr, amount: lrResult.preds[i], lower: lrResult.lower[i], upper: lrResult.upper[i], model: 'linear_regression', period: 'monthly', municipalityId });
    }

    return this.storePredictions(predictions);
  }

  // Compute annual predictions for next `years` years and persist
  async computeAndStoreAnnual(years = 3, municipalityId?: string) {
    const annual = await this.getAnnualSums();
    const amounts = annual.map((a) => a.amount);
    const lastPeriod = annual.length > 0 ? annual[annual.length - 1].period : null; // 'YYYY'

    const lrResult = this.linearRegressionPredict(amounts.slice(), years);

    const predictions: any[] = [];
    let y = lastPeriod ? parseInt(lastPeriod, 10) : new Date().getFullYear();
    for (let i = 0; i < years; i++) {
      y += 1;
      const yearStr = `${y}-01-01`;
      predictions.push({ predictedDate: yearStr, amount: lrResult.preds[i], lower: lrResult.lower[i], upper: lrResult.upper[i], model: 'linear_regression', period: 'annual', municipalityId });
    }

    return this.storePredictions(predictions);
  }

  // Convenience: run both
  async runAll(months = 12, years = 3) {
    await this.computeAndStoreMonthly(months);
    await this.computeAndStoreAnnual(years);
    return true;
  }
}

export default new PredictionService();
