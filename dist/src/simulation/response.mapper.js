"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildOptimizedResponse = void 0;
function toNumber(n) {
    const v = typeof n === 'string' ? Number(n) : n;
    return Number.isFinite(v) ? v : null;
}
function extractWeather(sim) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const w = (sim === null || sim === void 0 ? void 0 : sim.weatherContext) || null;
    if (!w)
        return null;
    const city = w.location || w.name || null;
    const temp = (_c = (_a = w.temp) !== null && _a !== void 0 ? _a : (_b = w === null || w === void 0 ? void 0 : w.main) === null || _b === void 0 ? void 0 : _b.temp) !== null && _c !== void 0 ? _c : null;
    const humidity = (_f = (_d = w.humidity) !== null && _d !== void 0 ? _d : (_e = w === null || w === void 0 ? void 0 : w.main) === null || _e === void 0 ? void 0 : _e.humidity) !== null && _f !== void 0 ? _f : null;
    const description = (_j = (_g = w.description) !== null && _g !== void 0 ? _g : (Array.isArray(w.weather) && ((_h = w.weather[0]) === null || _h === void 0 ? void 0 : _h.description))) !== null && _j !== void 0 ? _j : null;
    return city || temp != null || description || humidity != null
        ? { city, temperature: temp, humidity, description }
        : null;
}
function findYearValueFromWorldBankArray(arr, year) {
    if (Array.isArray(arr) && arr.length >= 2 && Array.isArray(arr[1])) {
        const dataArray = arr[1];
        const byYear = dataArray.find((e) => String(e === null || e === void 0 ? void 0 : e.date) === year && (e === null || e === void 0 ? void 0 : e.value) != null);
        if (byYear)
            return toNumber(byYear.value);
        const firstNonNull = dataArray.find((e) => (e === null || e === void 0 ? void 0 : e.value) != null);
        return firstNonNull ? toNumber(firstNonNull.value) : null;
    }
    return null;
}
function findYearValueFromReduced(obj, year) {
    const recent = obj === null || obj === void 0 ? void 0 : obj.recent;
    if (Array.isArray(recent)) {
        const byYear = recent.find((e) => String(e === null || e === void 0 ? void 0 : e.date) === year && (e === null || e === void 0 ? void 0 : e.value) != null);
        if (byYear)
            return toNumber(byYear.value);
        const first = recent.find((e) => (e === null || e === void 0 ? void 0 : e.value) != null);
        return first ? toNumber(first.value) : null;
    }
    return null;
}
function extractEconomics(sim) {
    var _a, _b, _c;
    const econ = (sim === null || sim === void 0 ? void 0 : sim.economicContext) || (sim === null || sim === void 0 ? void 0 : sim.economy) || (sim === null || sim === void 0 ? void 0 : sim.economic) || null;
    if (!econ)
        return null;
    const year = '2024';
    let population = null;
    const pop = ((_b = (_a = econ.population) !== null && _a !== void 0 ? _a : econ.SPOP) !== null && _b !== void 0 ? _b : econ.SP_POP_TOTL);
    if (pop) {
        if (Array.isArray(pop))
            population = findYearValueFromWorldBankArray(pop, year);
        else if (pop === null || pop === void 0 ? void 0 : pop.recent)
            population = findYearValueFromReduced(pop, year);
        else if (typeof pop === 'number')
            population = pop;
    }
    let gdpUsd = null;
    const gdp = ((_c = econ.gdp) !== null && _c !== void 0 ? _c : econ.NY_GDP_MKTP_CD);
    if (gdp) {
        if (Array.isArray(gdp))
            gdpUsd = findYearValueFromWorldBankArray(gdp, year);
        else if (gdp === null || gdp === void 0 ? void 0 : gdp.recent)
            gdpUsd = findYearValueFromReduced(gdp, year);
        else if (typeof gdp === 'number')
            gdpUsd = gdp;
    }
    return { population_2024: population, gdp_2024_usd: gdpUsd };
}
function extractDemographics(sim) {
    var _a, _b, _c, _d, _e, _f;
    const demo = (sim === null || sim === void 0 ? void 0 : sim.demographicContext) || (sim === null || sim === void 0 ? void 0 : sim.demographics) || (sim === null || sim === void 0 ? void 0 : sim.demography) || null;
    if (!demo)
        return null;
    return {
        country: (_a = demo.country) !== null && _a !== void 0 ? _a : null,
        capital: (_b = demo.capital) !== null && _b !== void 0 ? _b : null,
        region: (_c = demo.region) !== null && _c !== void 0 ? _c : null,
        population: (_d = demo.population) !== null && _d !== void 0 ? _d : null,
        languages: (_e = demo.languages) !== null && _e !== void 0 ? _e : [],
        gini: (_f = demo.gini) !== null && _f !== void 0 ? _f : null,
    };
}
function extractSeason(sim) {
    var _a, _b;
    const sc = ((_a = sim === null || sim === void 0 ? void 0 : sim.parameters) === null || _a === void 0 ? void 0 : _a.seasonContext) || (sim === null || sim === void 0 ? void 0 : sim.seasonContext) || null;
    return (_b = sc === null || sc === void 0 ? void 0 : sc.season) !== null && _b !== void 0 ? _b : null;
}
function extractParameters(sim) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const p = (sim === null || sim === void 0 ? void 0 : sim.parameters) || {};
    return {
        revenue_id: (_a = p.revenueId) !== null && _a !== void 0 ? _a : null,
        original_amount: (_b = p.originalAmount) !== null && _b !== void 0 ? _b : null,
        new_amount: (_c = p.newAmount) !== null && _c !== void 0 ? _c : null,
        frequency: (_d = p.frequency) !== null && _d !== void 0 ? _d : null,
        duration_months: (_e = p.durationMonths) !== null && _e !== void 0 ? _e : null,
        start_date: (_f = p.startDate) !== null && _f !== void 0 ? _f : null,
        devise: (_g = p.devise) !== null && _g !== void 0 ? _g : null,
        season: (_h = extractSeason(sim)) !== null && _h !== void 0 ? _h : null,
    };
}
function extractAi(analysis) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
    const rd = (analysis === null || analysis === void 0 ? void 0 : analysis.resultData) || {};
    const ai = (rd === null || rd === void 0 ? void 0 : rd.aiAnalysis) || null;
    if (!ai && !(rd === null || rd === void 0 ? void 0 : rd.aiModel) && !(rd === null || rd === void 0 ? void 0 : rd.aiError))
        return null;
    if (rd === null || rd === void 0 ? void 0 : rd.aiError) {
        return {
            model: (_a = rd === null || rd === void 0 ? void 0 : rd.aiModel) !== null && _a !== void 0 ? _a : null,
            error: rd === null || rd === void 0 ? void 0 : rd.aiError,
            error_details: (_b = rd === null || rd === void 0 ? void 0 : rd.aiErrorDetailed) !== null && _b !== void 0 ? _b : null,
            confidence: null,
            prediction_summary: null,
            interpretation: null,
            risks: [],
            opportunities: [],
            recommendations: [],
        };
    }
    const prediction_summary = (_d = (_c = ai === null || ai === void 0 ? void 0 : ai.prediction) === null || _c === void 0 ? void 0 : _c.summary) !== null && _d !== void 0 ? _d : null;
    const key_values = (_g = (_f = (_e = ai === null || ai === void 0 ? void 0 : ai.prediction) === null || _e === void 0 ? void 0 : _e.key_values) !== null && _f !== void 0 ? _f : ai === null || ai === void 0 ? void 0 : ai.key_values) !== null && _g !== void 0 ? _g : undefined;
    return {
        model: (_h = rd === null || rd === void 0 ? void 0 : rd.aiModel) !== null && _h !== void 0 ? _h : null,
        confidence: (_j = ai === null || ai === void 0 ? void 0 : ai.confidence) !== null && _j !== void 0 ? _j : null,
        prediction_summary: prediction_summary !== null && prediction_summary !== void 0 ? prediction_summary : null,
        key_values: key_values !== null && key_values !== void 0 ? key_values : undefined,
        interpretation: (_k = ai === null || ai === void 0 ? void 0 : ai.interpretation) !== null && _k !== void 0 ? _k : null,
        risks: (_l = ai === null || ai === void 0 ? void 0 : ai.risks) !== null && _l !== void 0 ? _l : [],
        opportunities: (_m = ai === null || ai === void 0 ? void 0 : ai.opportunities) !== null && _m !== void 0 ? _m : [],
        recommendations: (_o = ai === null || ai === void 0 ? void 0 : ai.recommendations) !== null && _o !== void 0 ? _o : [],
    };
}
function buildOptimizedResponse(payload) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    const sim = payload.simulation;
    const analysis = payload.analysis;
    const rd = (analysis === null || analysis === void 0 ? void 0 : analysis.resultData) || {};
    return {
        simulation_id: (_a = sim === null || sim === void 0 ? void 0 : sim.id) !== null && _a !== void 0 ? _a : null,
        created_at: (_b = sim === null || sim === void 0 ? void 0 : sim.createdAt) !== null && _b !== void 0 ? _b : null,
        parameters: extractParameters(sim),
        weather: extractWeather(sim),
        economic: extractEconomics(sim),
        demographics: extractDemographics(sim),
        analysis_results: {
            analysis_id: (_c = analysis === null || analysis === void 0 ? void 0 : analysis.id) !== null && _c !== void 0 ? _c : null,
            baseline_total: (_d = rd === null || rd === void 0 ? void 0 : rd.baselineTotal) !== null && _d !== void 0 ? _d : null,
            simulated_total: (_e = rd === null || rd === void 0 ? void 0 : rd.simulatedTotal) !== null && _e !== void 0 ? _e : null,
            delta_total: (_f = rd === null || rd === void 0 ? void 0 : rd.deltaTotal) !== null && _f !== void 0 ? _f : null,
            percent_change: (_g = rd === null || rd === void 0 ? void 0 : rd.percentChange) !== null && _g !== void 0 ? _g : null,
            months: (_h = rd === null || rd === void 0 ? void 0 : rd.months) !== null && _h !== void 0 ? _h : [],
            baseline_series: (_j = rd === null || rd === void 0 ? void 0 : rd.baselineSeries) !== null && _j !== void 0 ? _j : [],
            simulated_series: (_k = rd === null || rd === void 0 ? void 0 : rd.simulatedSeries) !== null && _k !== void 0 ? _k : [],
            ai_analysis: extractAi(analysis),
        },
    };
}
exports.buildOptimizedResponse = buildOptimizedResponse;
exports.default = buildOptimizedResponse;
//# sourceMappingURL=response.mapper.js.map