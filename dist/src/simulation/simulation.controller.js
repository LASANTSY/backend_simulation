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
const express_1 = __importDefault(require("express"));
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const create_simulation_dto_1 = require("./dto/create-simulation.dto");
const simulation_service_1 = __importDefault(require("./simulation.service"));
const response_mapper_1 = __importDefault(require("./response.mapper"));
const place_service_1 = require("../integrations/place.service");
const context_service_1 = __importDefault(require("../context/context.service"));
const router = express_1.default.Router();
const placeService = new place_service_1.PlaceService();
router.post('/simulations', async (req, res) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s;
    const dto = (0, class_transformer_1.plainToInstance)(create_simulation_dto_1.CreateSimulationDto, req.body);
    const errors = await (0, class_validator_1.validate)(dto, { whitelist: true, forbidNonWhitelisted: false });
    if (errors.length > 0)
        return res.status(400).json({ errors });
    try {
        let weatherContext = dto.weatherContext;
        let economicContext = dto.economicContext;
        let demographicContext = dto.demographicContext;
        let seasonContext = dto.seasonContext;
        if ((!weatherContext || !economicContext || !demographicContext || !seasonContext) && dto.city) {
            try {
                console.log('[Simulation Controller] Fetching contexts for city:', dto.city);
                const info = await placeService.getCityInfo(dto.city);
                const lat = info.lat;
                const lon = info.lon;
                console.log('[Simulation Controller] City info:', { lat, lon, country: (_a = info.address) === null || _a === void 0 ? void 0 : _a.country_code });
                let countryForIndicators = undefined;
                try {
                    const countryKey = (_c = (_b = info.address) === null || _b === void 0 ? void 0 : _b.country_code) !== null && _c !== void 0 ? _c : (_d = info.address) === null || _d === void 0 ? void 0 : _d.country;
                    if (countryKey) {
                        const dem = await context_service_1.default.fetchDemographics(countryKey);
                        if (Array.isArray(dem) && dem.length > 0) {
                            const c0 = dem[0];
                            countryForIndicators = (_g = (_f = (_e = c0 === null || c0 === void 0 ? void 0 : c0.cca2) !== null && _e !== void 0 ? _e : c0 === null || c0 === void 0 ? void 0 : c0.cca3) !== null && _f !== void 0 ? _f : c0 === null || c0 === void 0 ? void 0 : c0.cca1) !== null && _g !== void 0 ? _g : undefined;
                        }
                        else if (dem && dem.cca3) {
                            countryForIndicators = (_h = dem.cca2) !== null && _h !== void 0 ? _h : dem.cca3;
                        }
                    }
                }
                catch (demErr) {
                    console.warn('[Simulation Controller] Demographics fetch for country resolution failed:', demErr);
                    countryForIndicators = ((_j = info.address) === null || _j === void 0 ? void 0 : _j.country_code) ? info.address.country_code.toUpperCase() : (_k = info.address) === null || _k === void 0 ? void 0 : _k.country;
                }
                console.log('[Simulation Controller] Country for indicators:', countryForIndicators);
                const simPlaceholder = { parameters: { location: { lat, lon }, country: countryForIndicators !== null && countryForIndicators !== void 0 ? countryForIndicators : (_l = info.address) === null || _l === void 0 ? void 0 : _l.country, startDate: dto.startDate } };
                const fetched = await context_service_1.default.fetchContextForSimulation(simPlaceholder);
                console.log('[Simulation Controller] Fetched contexts:', {
                    hasWeather: !!fetched.weather,
                    hasEconomic: !!fetched.economic,
                    hasDemographics: !!fetched.demographics,
                    hasSeason: !!fetched.season,
                    errors: fetched._errors
                });
                weatherContext = (_m = weatherContext !== null && weatherContext !== void 0 ? weatherContext : fetched.weather) !== null && _m !== void 0 ? _m : null;
                economicContext = (_p = (_o = economicContext !== null && economicContext !== void 0 ? economicContext : fetched.economic) !== null && _o !== void 0 ? _o : fetched.economy) !== null && _p !== void 0 ? _p : null;
                demographicContext = (_q = demographicContext !== null && demographicContext !== void 0 ? demographicContext : fetched.demographics) !== null && _q !== void 0 ? _q : null;
                seasonContext = seasonContext !== null && seasonContext !== void 0 ? seasonContext : (fetched.season ? { season: fetched.season } : null);
                console.log('[Simulation Controller] Final contexts to pass:', {
                    hasWeather: !!weatherContext,
                    hasEconomic: !!economicContext,
                    hasDemographics: !!demographicContext,
                    hasSeason: !!seasonContext
                });
                req._contextFetchInfo = { cityInfo: info, fetched };
            }
            catch (e) {
                console.warn('Context auto-fetch failed:', e);
            }
        }
        else {
            console.log('[Simulation Controller] Skipping context fetch. City provided:', !!dto.city, 'Contexts already present:', {
                weather: !!weatherContext,
                economic: !!economicContext,
                demographic: !!demographicContext,
                season: !!seasonContext
            });
        }
        const result = await simulation_service_1.default.createAndRunSimulation({
            revenueId: dto.revenueId,
            newAmount: dto.newAmount,
            frequency: dto.frequency,
            durationMonths: dto.durationMonths,
            startDate: dto.startDate,
            note: dto.note,
            devise: (_s = (_r = dto.devise) !== null && _r !== void 0 ? _r : process.env.DEFAULT_CURRENCY) !== null && _s !== void 0 ? _s : 'MGA',
            weatherContext,
            economicContext,
            demographicContext,
            seasonContext,
            city: dto.city,
        });
        const wantRaw = String(req.query.raw || '').toLowerCase() === 'true' || String(req.headers['x-response-mode'] || '').toLowerCase() === 'raw';
        if (wantRaw) {
            const debugInfo = req._contextFetchInfo;
            if (debugInfo && (process.env.NODE_ENV !== 'production')) {
                result._debug = { contextFetch: debugInfo };
            }
            return res.status(201).json(result);
        }
        const optimized = (0, response_mapper_1.default)(result);
        return res.status(201).json(optimized);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Simulation failed', error: String(err) });
    }
});
router.get('/simulations', async (req, res) => {
    const municipalityId = req.query.municipalityId || undefined;
    const sims = await simulation_service_1.default.findAllSimulations(municipalityId);
    res.json(sims);
});
router.get('/simulations/:id', async (req, res) => {
    const id = req.params.id;
    const s = await simulation_service_1.default.findSimulation(id);
    if (!s)
        return res.status(404).json({ message: 'Not found' });
    res.json(s);
});
router.get('/analysis-results', async (_req, res) => {
    const repo = (await Promise.resolve().then(() => __importStar(require('../data-source')))).default.getRepository('AnalysisResult');
    const items = await repo.find({ order: { createdAt: 'DESC' } });
    res.json(items);
});
exports.default = router;
router.get('/_debug/context', async (req, res) => {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    if (process.env.NODE_ENV === 'production')
        return res.status(403).json({ message: 'Forbidden in production' });
    const city = req.query.city || req.query.ville;
    if (!city)
        return res.status(400).json({ message: 'city query parameter is required' });
    try {
        const info = await placeService.getCityInfo(city);
        const lat = info.lat;
        const lon = info.lon;
        let countryForIndicators = undefined;
        try {
            const countryKey = (_b = (_a = info.address) === null || _a === void 0 ? void 0 : _a.country_code) !== null && _b !== void 0 ? _b : (_c = info.address) === null || _c === void 0 ? void 0 : _c.country;
            if (countryKey) {
                const dem = await context_service_1.default.fetchDemographics(countryKey);
                if (Array.isArray(dem) && dem.length > 0) {
                    const c0 = dem[0];
                    countryForIndicators = (_e = (_d = c0 === null || c0 === void 0 ? void 0 : c0.cca3) !== null && _d !== void 0 ? _d : c0 === null || c0 === void 0 ? void 0 : c0.cca2) !== null && _e !== void 0 ? _e : undefined;
                }
                else if (dem && dem.cca3) {
                    countryForIndicators = dem.cca3;
                }
            }
        }
        catch (e) {
            countryForIndicators = ((_f = info.address) === null || _f === void 0 ? void 0 : _f.country_code) ? info.address.country_code.toUpperCase() : (_g = info.address) === null || _g === void 0 ? void 0 : _g.country;
        }
        const simPlaceholder = { parameters: { location: { lat, lon }, country: countryForIndicators !== null && countryForIndicators !== void 0 ? countryForIndicators : (_h = info.address) === null || _h === void 0 ? void 0 : _h.country, startDate: req.query.startDate } };
        const fetched = await context_service_1.default.fetchContextForSimulation(simPlaceholder);
        res.json({ cityInfo: info, countryForIndicators, fetched });
    }
    catch (err) {
        console.error('Debug context fetch error', err);
        res.status(500).json({ message: 'Debug fetch failed', error: String(err) });
    }
});
//# sourceMappingURL=simulation.controller.js.map