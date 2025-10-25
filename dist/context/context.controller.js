"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const context_service_1 = __importDefault(require("./context.service"));
const router = express_1.default.Router();
router.get('/context/weather', async (req, res) => {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    const date = req.query.date;
    if (!lat || !lon)
        return res.status(400).json({ message: 'lat and lon required' });
    try {
        const data = await context_service_1.default.fetchWeather(lat, lon, date);
        res.json(data);
    }
    catch (err) {
        res.status(500).json({ message: String(err) });
    }
});
router.get('/context/economic', async (req, res) => {
    const country = (req.query.country || req.query.c);
    const indicator = (req.query.indicator || req.query.i);
    if (!country || !indicator)
        return res.status(400).json({ message: 'country and indicator required' });
    try {
        const data = await context_service_1.default.fetchEconomicIndicator(country, indicator);
        res.json(data);
    }
    catch (err) {
        res.status(500).json({ message: String(err) });
    }
});
router.get('/context/demographics', async (req, res) => {
    const country = (req.query.country || req.query.c);
    if (!country)
        return res.status(400).json({ message: 'country required' });
    try {
        const data = await context_service_1.default.fetchDemographics(country);
        res.json(data);
    }
    catch (err) {
        res.status(500).json({ message: String(err) });
    }
});
exports.default = router;
//# sourceMappingURL=context.controller.js.map