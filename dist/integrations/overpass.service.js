"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OverpassService = void 0;
const axios_1 = __importDefault(require("axios"));
const data_source_1 = __importDefault(require("../data-source"));
const marketplace_entity_1 = require("./marketplace.entity");
class OverpassService {
    constructor() {
        this.endpoint = 'https://overpass-api.de/api/interpreter';
        this.timeoutMs = 25000;
    }
    buildQuery(bbox) {
        const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
        return `
[out:json][timeout:25];
(
  node["amenity"="marketplace"](${bboxStr});
  way["amenity"="marketplace"](${bboxStr});
  relation["amenity"="marketplace"](${bboxStr});
);
out body;
>;
out skel qt;
`;
    }
    async fetchAndStoreMarkets(bbox) {
        var _a;
        const query = this.buildQuery(bbox);
        let response;
        try {
            response = await axios_1.default.post(this.endpoint, query, {
                headers: { 'Content-Type': 'text/plain' },
                timeout: this.timeoutMs,
            });
        }
        catch (err) {
            if ((err === null || err === void 0 ? void 0 : err.code) === 'ECONNABORTED') {
                throw new Error('Overpass request timed out');
            }
            throw new Error('Failed to contact Overpass API');
        }
        const elements = ((_a = response.data) === null || _a === void 0 ? void 0 : _a.elements) || [];
        const nodeMap = new Map();
        for (const el of elements) {
            if (el.type === 'node') {
                nodeMap.set(el.id, { lat: el.lat, lon: el.lon });
            }
        }
        const repo = data_source_1.default.getRepository(marketplace_entity_1.Marketplace);
        const results = [];
        for (const el of elements) {
            if (!el.tags || el.tags['amenity'] !== 'marketplace')
                continue;
            let lat = null;
            let lon = null;
            if (el.type === 'node') {
                lat = el.lat;
                lon = el.lon;
            }
            else if (el.type === 'way' && Array.isArray(el.nodes)) {
                const coords = el.nodes
                    .map((nid) => nodeMap.get(nid))
                    .filter(Boolean);
                if (coords.length) {
                    lat = coords.reduce((s, c) => s + c.lat, 0) / coords.length;
                    lon = coords.reduce((s, c) => s + c.lon, 0) / coords.length;
                }
            }
            else if (el.type === 'relation' && Array.isArray(el.members)) {
                const coords = el.members
                    .filter((m) => m.type === 'node' && nodeMap.has(m.ref))
                    .map((m) => nodeMap.get(m.ref))
                    .filter(Boolean);
                if (coords.length) {
                    lat = coords.reduce((s, c) => s + c.lat, 0) / coords.length;
                    lon = coords.reduce((s, c) => s + c.lon, 0) / coords.length;
                }
            }
            const osmId = `${el.type}:${el.id}`;
            const tags = el.tags || {};
            const name = tags.name || null;
            const city = tags['addr:city'] || tags.is_in || null;
            let existing = await repo.findOne({ where: { osm_id: osmId } });
            if (existing) {
                existing.name = name || existing.name;
                existing.latitude = lat !== null && lat !== void 0 ? lat : existing.latitude;
                existing.longitude = lon !== null && lon !== void 0 ? lon : existing.longitude;
                existing.tags = tags;
                existing.city = city || existing.city;
                existing.fetched_at = new Date();
                existing = await repo.save(existing);
                results.push(existing);
            }
            else {
                const created = repo.create({
                    osm_id: osmId,
                    name,
                    latitude: lat,
                    longitude: lon,
                    tags,
                    city,
                });
                const saved = await repo.save(created);
                results.push(saved);
            }
        }
        return results;
    }
}
exports.OverpassService = OverpassService;
//# sourceMappingURL=overpass.service.js.map