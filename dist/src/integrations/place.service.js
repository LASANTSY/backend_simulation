"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaceService = void 0;
const axios_1 = __importDefault(require("axios"));
class PlaceService {
    constructor() {
        this.endpoint = 'https://nominatim.openstreetmap.org/search';
        this.timeoutMs = 10000;
    }
    async getCityBBox(city) {
        try {
            const resp = await axios_1.default.get(this.endpoint, {
                params: {
                    q: city,
                    format: 'json',
                    limit: 1,
                },
                timeout: this.timeoutMs,
                headers: {
                    'User-Agent': 'mobilisation-backend/1.0 (contact@example.com)'
                }
            });
            const data = resp.data;
            if (!Array.isArray(data) || data.length === 0) {
                throw new Error('not_found');
            }
            const first = data[0];
            const bb = first.boundingbox;
            if (!bb || bb.length < 4)
                throw new Error('invalid_response');
            const south = parseFloat(bb[0]);
            const north = parseFloat(bb[1]);
            const west = parseFloat(bb[2]);
            const east = parseFloat(bb[3]);
            return { south, west, north, east, display_name: first.display_name };
        }
        catch (err) {
            if ((err === null || err === void 0 ? void 0 : err.message) === 'not_found')
                throw err;
            if ((err === null || err === void 0 ? void 0 : err.code) === 'ECONNABORTED')
                throw new Error('timeout');
            throw new Error('service_error');
        }
    }
    async getCityInfo(city) {
        var _a, _b, _c, _d, _e;
        const maxAttempts = 3;
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        let lastErr = null;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const resp = await axios_1.default.get(this.endpoint, {
                    params: {
                        q: city,
                        format: 'json',
                        limit: 1,
                        addressdetails: 1,
                    },
                    timeout: this.timeoutMs,
                    headers: {
                        'User-Agent': 'mobilisation-backend/1.0 (contact@example.com)'
                    }
                });
                const data = resp.data;
                if (!Array.isArray(data) || data.length === 0)
                    throw new Error('not_found');
                const first = data[0];
                const lat = parseFloat(first.lat);
                const lon = parseFloat(first.lon);
                return { lat, lon, display_name: first.display_name, address: first.address };
            }
            catch (err) {
                lastErr = err;
                if ((err === null || err === void 0 ? void 0 : err.message) === 'not_found')
                    throw err;
                if ((err === null || err === void 0 ? void 0 : err.code) === 'ECONNABORTED') {
                    if (attempt === maxAttempts)
                        throw new Error('timeout');
                    await sleep(200 * attempt);
                    continue;
                }
                const status = (_a = err === null || err === void 0 ? void 0 : err.response) === null || _a === void 0 ? void 0 : _a.status;
                if (status && status >= 500 && attempt < maxAttempts) {
                    await sleep(250 * attempt);
                    continue;
                }
                const statusInfo = status ? `status=${status}` : `code=${(_b = err === null || err === void 0 ? void 0 : err.code) !== null && _b !== void 0 ? _b : 'unknown'}`;
                const body = ((_c = err === null || err === void 0 ? void 0 : err.response) === null || _c === void 0 ? void 0 : _c.data) ? ` body=${JSON.stringify(err.response.data)}` : '';
                const message = `service_error: ${(_d = err === null || err === void 0 ? void 0 : err.message) !== null && _d !== void 0 ? _d : 'unknown'} (${statusInfo})${body}`;
                throw new Error(message);
            }
        }
        throw new Error(`service_error: ${(_e = lastErr === null || lastErr === void 0 ? void 0 : lastErr.message) !== null && _e !== void 0 ? _e : 'unknown'}`);
    }
}
exports.PlaceService = PlaceService;
//# sourceMappingURL=place.service.js.map