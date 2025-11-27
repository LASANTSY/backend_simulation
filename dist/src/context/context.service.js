"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextService = void 0;
const node_cache_1 = __importDefault(require("node-cache"));
const axios_1 = __importDefault(require("axios"));
const data_source_1 = __importDefault(require("../data-source"));
const WeatherContext_1 = require("../entities/WeatherContext");
const EconomicIndicator_1 = require("../entities/EconomicIndicator");
const Demographic_1 = require("../entities/Demographic");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const WEATHER_KEY = process.env.OPENWEATHER_API_KEY || '';
const CACHE_TTL = parseInt(process.env.CONTEXT_CACHE_TTL || '3600', 10);
const WB_INDICATOR_URL = process.env.WB_INDICATOR_URL || process.env.WB_INDICATOR_API_KEY || 'https://api.worldbank.org/v2/country/{country}/indicator/{indicator}?format=json&per_page=100';
const WB_COUNTRY_URL = process.env.WB_COUNTRY_URL || process.env.WB_COUNTRY_API_KEY || 'https://api.worldbank.org/v2/country/{country}/indicator?format=json';
const IMF_INDICATOR_URL = process.env.IMF_INDICATOR_URL || process.env.IMF_INDICATOR_API_KEY || '';
const IMF_COUNTRY_URL = process.env.IMF_COUNTRY_URL || process.env.IMF_COUNTRY_API_KEY || '';
const IMF_API_KEY = process.env.IMF_INDICATOR_API_KEY || process.env.IMF_API_KEY || '';
class ContextService {
    constructor() {
        this.cache = new node_cache_1.default({ stdTTL: CACHE_TTL, checkperiod: 120 });
        this.weatherRepo = data_source_1.default.getRepository(WeatherContext_1.WeatherContext);
        this.econRepo = data_source_1.default.getRepository(EconomicIndicator_1.EconomicIndicator);
        this.demoRepo = data_source_1.default.getRepository(Demographic_1.Demographic);
    }
    async fetchWeather(lat, lon, date) {
        var _a, _b, _c, _d;
        const key = `${lat}_${lon}_${date || 'current'}`;
        const cached = this.cache.get(key);
        if (cached)
            return cached;
        const db = await this.weatherRepo.findOneBy({ key });
        if (db) {
            this.cache.set(key, db.data);
            return db.data;
        }
        if (!WEATHER_KEY)
            throw new Error('OPENWEATHER_API_KEY not configured');
        let url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${WEATHER_KEY}&units=metric`;
        try {
            const resp = await axios_1.default.get(url, { timeout: 10000 });
            const data = resp.data;
            const ent = this.weatherRepo.create({ key, data });
            await this.weatherRepo.save(ent);
            const compact = {
                location: data.name,
                temp: (_b = (_a = data === null || data === void 0 ? void 0 : data.main) === null || _a === void 0 ? void 0 : _a.temp) !== null && _b !== void 0 ? _b : null,
                description: Array.isArray(data === null || data === void 0 ? void 0 : data.weather) && data.weather.length > 0 ? data.weather[0].description : null,
                humidity: (_d = (_c = data === null || data === void 0 ? void 0 : data.main) === null || _c === void 0 ? void 0 : _c.humidity) !== null && _d !== void 0 ? _d : null,
                coords: (data === null || data === void 0 ? void 0 : data.coord) ? { lat: data.coord.lat, lon: data.coord.lon } : null,
            };
            this.cache.set(key, compact);
            return compact;
        }
        catch (err) {
            throw new Error('Weather fetch failed: ' + String(err));
        }
    }
    async fetchEconomicIndicator(countryCode, indicator) {
        var _a;
        const key = `${countryCode}_${indicator}`;
        const cached = this.cache.get(key);
        if (cached)
            return cached;
        const db = await this.econRepo.findOneBy({ country: countryCode, indicator });
        if (db) {
            this.cache.set(key, db.data);
            return db.data;
        }
        let urlTemplate = WB_INDICATOR_URL;
        const envProvided = !!process.env.WB_INDICATOR_API_KEY;
        let url;
        if (urlTemplate && urlTemplate.includes('{country}') && urlTemplate.includes('{indicator}')) {
            url = urlTemplate.replace('{country}', encodeURIComponent(countryCode)).replace('{indicator}', encodeURIComponent(indicator));
        }
        else if (urlTemplate && urlTemplate.startsWith('http')) {
            url = `${urlTemplate.replace(/\/$/, '')}/country/${encodeURIComponent(countryCode)}/indicator/${encodeURIComponent(indicator)}?format=json&per_page=100`;
        }
        else {
            url = `https://api.worldbank.org/v2/country/${encodeURIComponent(countryCode)}/indicator/${encodeURIComponent(indicator)}?format=json&per_page=100`;
        }
        try {
            console.log(`[ContextService] fetchEconomicIndicator: requesting URL: ${url}`);
            const resp = await axios_1.default.get(url, { timeout: 10000, headers: { Accept: 'application/json' } });
            let data = resp.data;
            if (typeof data === 'string' && /<\?xml|<wb:error/i.test(data)) {
                console.warn('[ContextService] fetchEconomicIndicator: received XML response, retrying with fallback URL');
                const fallback = `https://api.worldbank.org/v2/country/${encodeURIComponent(countryCode)}/indicator/${encodeURIComponent(indicator)}?format=json&per_page=100`;
                console.log(`[ContextService] fetchEconomicIndicator: retrying with ${fallback}`);
                const resp2 = await axios_1.default.get(fallback, { timeout: 10000, headers: { Accept: 'application/json' } });
                data = resp2.data;
            }
            let reduced = data;
            if (Array.isArray(data) && data.length >= 2 && Array.isArray(data[1])) {
                const dataArray = data[1];
                const recentYears = 3;
                const recent = [];
                for (const entry of dataArray) {
                    if (recent.length >= recentYears)
                        break;
                    if (entry && typeof entry.date !== 'undefined') {
                        recent.push({ date: entry.date, value: (_a = entry.value) !== null && _a !== void 0 ? _a : null });
                    }
                }
                reduced = { country: countryCode, indicator, recent };
            }
            const ent = this.econRepo.create({ country: countryCode, indicator, data });
            await this.econRepo.save(ent);
            this.cache.set(key, reduced);
            return reduced;
        }
        catch (err) {
            throw new Error('Economic indicator fetch failed (' + url + '): ' + String(err));
        }
    }
    async fetchIMFIndicator(countryCode, indicator) {
        if (!IMF_INDICATOR_URL) {
            throw new Error('IMF_INDICATOR_URL not configured');
        }
        const key = `imf_${countryCode}_${indicator}`;
        const cached = this.cache.get(key);
        if (cached)
            return cached;
        const db = await this.econRepo.findOneBy({ country: countryCode, indicator: `IMF:${indicator}` });
        if (db) {
            this.cache.set(key, db.data);
            return db.data;
        }
        let urlTemplate = IMF_INDICATOR_URL;
        const envProvided = !!IMF_INDICATOR_URL;
        let url;
        if (urlTemplate.includes('{country}') && urlTemplate.includes('{indicator}')) {
            url = urlTemplate.replace('{country}', encodeURIComponent(countryCode)).replace('{indicator}', encodeURIComponent(indicator));
        }
        else if (envProvided && urlTemplate.startsWith('http')) {
            url = `${urlTemplate.replace(/\/$/, '')}/country/${encodeURIComponent(countryCode)}/indicator/${encodeURIComponent(indicator)}`;
        }
        else {
            url = urlTemplate;
        }
        const hasQuery = url.includes('?');
        if (IMF_API_KEY && !/api_key=/.test(url)) {
            url = `${url}${hasQuery ? '&' : '?'}api_key=${encodeURIComponent(IMF_API_KEY)}&format=json`;
        }
        else if (!url.includes('?')) {
            url = `${url}?format=json`;
        }
        try {
            const resp = await axios_1.default.get(url, { timeout: 12000 });
            const data = resp.data;
            const ent = this.econRepo.create({ country: countryCode, indicator: `IMF:${indicator}`, data });
            await this.econRepo.save(ent);
            this.cache.set(key, data);
            return data;
        }
        catch (err) {
            throw new Error('IMF indicator fetch failed (' + url + '): ' + String(err));
        }
    }
    async fetchDemographics(countryCodeOrName) {
        var _a, _b, _c, _d, _e, _f;
        const key = `demo_${countryCodeOrName}`;
        const cached = this.cache.get(key);
        if (cached)
            return cached;
        const db = await this.demoRepo.findOneBy({ country: countryCodeOrName });
        if (db) {
            this.cache.set(key, db.data);
            return db.data;
        }
        const codeMatch = typeof countryCodeOrName === 'string' && /^[A-Za-z]{2,3}$/.test(countryCodeOrName.trim());
        const base = 'https://restcountries.com/v3.1';
        const url = codeMatch
            ? `${base}/alpha/${encodeURIComponent(countryCodeOrName.trim())}`
            : `${base}/name/${encodeURIComponent(countryCodeOrName)}`;
        try {
            const resp = await axios_1.default.get(url, { timeout: 10000 });
            const data = resp.data;
            const entry = Array.isArray(data) ? data[0] : data;
            const ent = this.demoRepo.create({ country: countryCodeOrName, data });
            await this.demoRepo.save(ent);
            const essential = {
                country: (_c = (_b = (_a = entry === null || entry === void 0 ? void 0 : entry.name) === null || _a === void 0 ? void 0 : _a.common) !== null && _b !== void 0 ? _b : entry === null || entry === void 0 ? void 0 : entry.name) !== null && _c !== void 0 ? _c : countryCodeOrName,
                capital: Array.isArray(entry === null || entry === void 0 ? void 0 : entry.capital) && entry.capital.length > 0 ? entry.capital[0] : null,
                languages: (entry === null || entry === void 0 ? void 0 : entry.languages) ? Object.values(entry.languages) : [],
                gini: (entry === null || entry === void 0 ? void 0 : entry.gini) ? (_d = Object.values(entry.gini)[0]) !== null && _d !== void 0 ? _d : null : null,
                region: (_e = entry === null || entry === void 0 ? void 0 : entry.region) !== null && _e !== void 0 ? _e : null,
                population: (_f = entry === null || entry === void 0 ? void 0 : entry.population) !== null && _f !== void 0 ? _f : null,
            };
            this.cache.set(key, essential);
            return essential;
        }
        catch (err) {
            throw new Error('Demographics fetch failed: ' + String(err));
        }
    }
    async fetchContextForSimulation(simulation) {
        const params = (simulation === null || simulation === void 0 ? void 0 : simulation.parameters) || {};
        const ctx = {};
        const errors = [];
        if (params.location && params.location.lat && params.location.lon) {
            try {
                ctx.weather = await this.fetchWeather(params.location.lat, params.location.lon, params.startDate);
                console.log('[ContextService] Weather context fetched successfully');
            }
            catch (err) {
                console.warn('[ContextService] Weather fetch failed:', String(err));
                errors.push(`weather: ${String(err)}`);
                ctx.weather = null;
            }
        }
        if (params.country) {
            ctx.economic = {};
            try {
                ctx.economic.population = await this.fetchEconomicIndicator(params.country, 'SP.POP.TOTL');
                console.log('[ContextService] Population indicator fetched successfully');
            }
            catch (err) {
                console.warn('[ContextService] Population fetch failed:', String(err));
                errors.push(`population: ${String(err)}`);
            }
            try {
                ctx.economic.gdp = await this.fetchEconomicIndicator(params.country, 'NY.GDP.MKTP.CD');
                console.log('[ContextService] GDP indicator fetched successfully');
            }
            catch (err) {
                console.warn('[ContextService] GDP fetch failed:', String(err));
                errors.push(`gdp: ${String(err)}`);
            }
            try {
                ctx.economic.imf_gdp = await this.fetchIMFIndicator(params.country, 'NGDP_RPCH');
                console.log('[ContextService] IMF GDP indicator fetched successfully');
            }
            catch (err) {
                console.warn('[ContextService] IMF GDP fetch failed (non-fatal):', String(err));
            }
            try {
                ctx.demographics = await this.fetchDemographics(params.country);
                console.log('[ContextService] Demographics fetched successfully');
            }
            catch (err) {
                console.warn('[ContextService] Demographics fetch failed:', String(err));
                errors.push(`demographics: ${String(err)}`);
                ctx.demographics = null;
            }
        }
        if (params.startDate) {
            try {
                const d = new Date(params.startDate);
                const month = d.getMonth() + 1;
                const season = month >= 3 && month <= 5 ? 'spring' : month >= 6 && month <= 8 ? 'summer' : month >= 9 && month <= 11 ? 'autumn' : 'winter';
                ctx.season = season;
                console.log('[ContextService] Season inferred:', season);
            }
            catch (err) {
                console.warn('[ContextService] Season inference failed:', String(err));
                errors.push(`season: ${String(err)}`);
            }
        }
        if (errors.length > 0) {
            ctx._errors = errors;
            console.warn(`[ContextService] Context fetch completed with ${errors.length} error(s):`, errors);
        }
        else {
            console.log('[ContextService] All contexts fetched successfully');
        }
        return ctx;
    }
}
exports.ContextService = ContextService;
exports.default = new ContextService();
//# sourceMappingURL=context.service.js.map