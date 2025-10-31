"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const context_service_1 = __importDefault(require("../src/context/context.service"));
const place_service_1 = require("../src/integrations/place.service");
(async () => {
    var _a, _b, _c;
    try {
        const ps = new place_service_1.PlaceService();
        const city = process.argv[2] || 'Antananarivo';
        console.log('City:', city);
        const info = await ps.getCityInfo(city);
        console.log('City info:', info);
        const countryKey = (_b = (_a = info.address) === null || _a === void 0 ? void 0 : _a.country_code) !== null && _b !== void 0 ? _b : (_c = info.address) === null || _c === void 0 ? void 0 : _c.country;
        console.log('Country key from Nominatim:', countryKey);
        try {
            const dem = await context_service_1.default.fetchDemographics(countryKey);
            console.log('Demographics (restcountries):', Array.isArray(dem) ? dem[0] : dem);
        }
        catch (e) {
            console.error('fetchDemographics error:', e.message || e);
        }
        const countryForIndicators = (async () => {
            try {
                const dem = await context_service_1.default.fetchDemographics(countryKey);
                if (Array.isArray(dem) && dem.length > 0)
                    return dem[0].cca3 || dem[0].cca2;
                if (dem && dem.cca3)
                    return dem.cca3;
            }
            catch (e) { }
            return countryKey === null || countryKey === void 0 ? void 0 : countryKey.toUpperCase();
        })();
        const cfi = await countryForIndicators;
        console.log('Country for indicators:', cfi);
        try {
            const pop = await context_service_1.default.fetchEconomicIndicator(cfi, 'SP.POP.TOTL');
            console.log('WorldBank population sample keys:', Object.keys(pop || {}).slice(0, 10));
        }
        catch (e) {
            console.error('fetchEconomicIndicator error:', e.message || e);
        }
        try {
            const weather = await context_service_1.default.fetchWeather(info.lat, info.lon);
            console.log('Weather sample keys:', Object.keys(weather || {}).slice(0, 10));
        }
        catch (e) {
            console.error('fetchWeather error:', e.message || e);
        }
    }
    catch (err) {
        console.error('Script error', err);
    }
})();
//# sourceMappingURL=debug-context.js.map