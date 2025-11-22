// Utility to transform { simulation, analysis } into a compact optimized JSON
// matching the example in response_optimized.json

type AnyObj = Record<string, any>;

function toNumber(n: any): number | null {
  const v = typeof n === 'string' ? Number(n) : n;
  return Number.isFinite(v) ? (v as number) : null;
}

function extractWeather(sim: AnyObj) {
  const w = sim?.weatherContext || null;
  if (!w) return null;
  // support both compact context.service shape and raw OpenWeather shape
  const city = w.location || w.name || null;
  const temp = w.temp ?? w?.main?.temp ?? null;
  const humidity = w.humidity ?? w?.main?.humidity ?? null;
  const description = w.description ?? (Array.isArray(w.weather) && w.weather[0]?.description) ?? null;
  return city || temp != null || description || humidity != null
    ? { city, temperature: temp, humidity, description }
    : null;
}

function findYearValueFromWorldBankArray(arr: any[], year: string) {
  // World Bank shape: [meta, dataArray]
  if (Array.isArray(arr) && arr.length >= 2 && Array.isArray(arr[1])) {
    const dataArray = arr[1];
    const byYear = dataArray.find((e: any) => String(e?.date) === year && e?.value != null);
    if (byYear) return toNumber(byYear.value);
    const firstNonNull = dataArray.find((e: any) => e?.value != null);
    return firstNonNull ? toNumber(firstNonNull.value) : null;
  }
  return null;
}

function findYearValueFromReduced(obj: AnyObj, year: string) {
  // Reduced shape from context.service: {country, indicator, recent: [{date, value}, ...]}
  const recent = obj?.recent;
  if (Array.isArray(recent)) {
    const byYear = recent.find((e: any) => String(e?.date) === year && e?.value != null);
    if (byYear) return toNumber(byYear.value);
    const first = recent.find((e: any) => e?.value != null);
    return first ? toNumber(first.value) : null;
  }
  return null;
}

function extractEconomics(sim: AnyObj) {
  const econ = sim?.economicContext || sim?.economy || sim?.economic || null;
  if (!econ) return null;
  const year = '2024';

  let population: number | null = null;
  const pop = (econ.population ?? econ.SPOP ?? econ.SP_POP_TOTL) as any;
  if (pop) {
    if (Array.isArray(pop)) population = findYearValueFromWorldBankArray(pop, year);
    else if (pop?.recent) population = findYearValueFromReduced(pop, year);
    else if (typeof pop === 'number') population = pop;
  }

  let gdpUsd: number | null = null;
  const gdp = (econ.gdp ?? econ.NY_GDP_MKTP_CD) as any;
  if (gdp) {
    if (Array.isArray(gdp)) gdpUsd = findYearValueFromWorldBankArray(gdp, year);
    else if (gdp?.recent) gdpUsd = findYearValueFromReduced(gdp, year);
    else if (typeof gdp === 'number') gdpUsd = gdp;
  }

  return { population_2024: population, gdp_2024_usd: gdpUsd };
}

function extractSeason(sim: AnyObj) {
  const sc = sim?.parameters?.seasonContext || sim?.seasonContext || null;
  return sc?.season ?? null;
}

function extractParameters(sim: AnyObj) {
  const p = sim?.parameters || {};
  return {
    revenue_id: p.revenueId ?? null,
    original_amount: p.originalAmount ?? null,
    new_amount: p.newAmount ?? null,
    frequency: p.frequency ?? null,
    duration_months: p.durationMonths ?? null,
    start_date: p.startDate ?? null,
    devise: p.devise ?? null,
    season: extractSeason(sim) ?? null,
  };
}

function extractAi(analysis: AnyObj) {
  const rd = analysis?.resultData || {};
  const ai = rd?.aiAnalysis || null;
  // Return null only if there's no AI data at all AND no error information
  if (!ai && !rd?.aiModel && !rd?.aiError) return null;
  
  // If there's an error, return error information
  if (rd?.aiError) {
    return {
      model: rd?.aiModel ?? null,
      error: rd?.aiError,
      error_details: rd?.aiErrorDetailed ?? null,
      confidence: null,
      prediction_summary: null,
      interpretation: null,
      risks: [],
      opportunities: [],
      recommendations: [],
    };
  }
  
  const prediction_summary = ai?.prediction?.summary ?? null;
  const key_values = ai?.prediction?.key_values ?? ai?.key_values ?? undefined;
  return {
    model: rd?.aiModel ?? null,
    confidence: ai?.confidence ?? null,
    prediction_summary: prediction_summary ?? null,
    key_values: key_values ?? undefined,
    interpretation: ai?.interpretation ?? null,
    risks: ai?.risks ?? [],
    opportunities: ai?.opportunities ?? [],
    recommendations: ai?.recommendations ?? [],
  };
}

export function buildOptimizedResponse(payload: { simulation: AnyObj; analysis: AnyObj }) {
  const sim = payload.simulation;
  const analysis = payload.analysis;
  const rd = analysis?.resultData || {};

  return {
    simulation_id: sim?.id ?? null,
    created_at: sim?.createdAt ?? null,
    parameters: extractParameters(sim),
    weather: extractWeather(sim),
    economic: extractEconomics(sim),
    analysis_results: {
      analysis_id: analysis?.id ?? null,
      baseline_total: rd?.baselineTotal ?? null,
      simulated_total: rd?.simulatedTotal ?? null,
      delta_total: rd?.deltaTotal ?? null,
      percent_change: rd?.percentChange ?? null,
      months: rd?.months ?? [],
      baseline_series: rd?.baselineSeries ?? [],
      simulated_series: rd?.simulatedSeries ?? [],
      ai_analysis: extractAi(analysis),
    },
  };
}

export default buildOptimizedResponse;
