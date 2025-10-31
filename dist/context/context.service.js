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
            this.cache.set(key, data);
            return data;
        }
        catch (err) {
            throw new Error('Weather fetch failed: ' + String(err));
        }
    }
    async fetchEconomicIndicator(countryCode, indicator) {
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
        if (urlTemplate.includes('{country}') && urlTemplate.includes('{indicator}')) {
            url = urlTemplate.replace('{country}', encodeURIComponent(countryCode)).replace('{indicator}', encodeURIComponent(indicator));
        }
        else if (envProvided && urlTemplate.startsWith('http')) {
            url = `${urlTemplate.replace(/\/$/, '')}/country/${encodeURIComponent(countryCode)}/indicator/${encodeURIComponent(indicator)}?format=json&per_page=100`;
        }
        else {
            url = `https://api.worldbank.org/v2/country/${countryCode}/indicator/${indicator}?format=json&per_page=100`;
        }
        try {
            const resp = await axios_1.default.get(url, { timeout: 10000 });
            const data = resp.data;
            const ent = this.econRepo.create({ country: countryCode, indicator, data });
            await this.econRepo.save(ent);
            this.cache.set(key, data);
            return data;
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
        const key = `demo_${countryCodeOrName}`;
        const cached = this.cache.get(key);
        if (cached)
            return cached;
        const db = await this.demoRepo.findOneBy({ country: countryCodeOrName });
        if (db) {
            this.cache.set(key, db.data);
            return db.data;
        }
        const url = `https://restcountries.com/v3.1/name/${encodeURIComponent(countryCodeOrName)}`;
        try {
            const resp = await axios_1.default.get(url, { timeout: 10000 });
            const data = resp.data;
            const ent = this.demoRepo.create({ country: countryCodeOrName, data });
            await this.demoRepo.save(ent);
            this.cache.set(key, data);
            return data;
        }
        catch (err) {
            throw new Error('Demographics fetch failed: ' + String(err));
        }
    }
    async fetchContextForSimulation(simulation) {
        try {
            const params = (simulation === null || simulation === void 0 ? void 0 : simulation.parameters) || {};
            const ctx = {};
            if (params.location && params.location.lat && params.location.lon) {
                ctx.weather = await this.fetchWeather(params.location.lat, params.location.lon, params.startDate);
            }
            if (params.country) {
                ctx.economic = {};
                ctx.economic.population = await this.fetchEconomicIndicator(params.country, 'SP.POP.TOTL');
                ctx.economic.gdp = await this.fetchEconomicIndicator(params.country, 'NY.GDP.MKTP.CD');
                try {
                    ctx.economic.imf_gdp = await this.fetchIMFIndicator(params.country, 'NGDP_RPCH');
                }
                catch (e) {
                }
                ctx.demographics = await this.fetchDemographics(params.country);
            }
            if (params.startDate) {
                const d = new Date(params.startDate);
                const month = d.getMonth() + 1;
                const season = month >= 3 && month <= 5 ? 'spring' : month >= 6 && month <= 8 ? 'summer' : month >= 9 && month <= 11 ? 'autumn' : 'winter';
                ctx.season = season;
            }
            return ctx;
        }
        catch (err) {
            return { _error: String(err) };
        }
    }
}
exports.ContextService = ContextService;
exports.default = new ContextService();
//# sourceMappingURL=context.service.js.map