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
            if ((err === null || err === void 0 ? void 0 : err.message) === 'not_found')
                throw err;
            if ((err === null || err === void 0 ? void 0 : err.code) === 'ECONNABORTED')
                throw new Error('timeout');
            throw new Error('service_error');
        }
    }
}
exports.PlaceService = PlaceService;
//# sourceMappingURL=place.service.js.map