import axios from 'axios';
import AppDataSource from '../data-source';
import { Marketplace } from './marketplace.entity';

interface Bbox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export class OverpassService {
  private readonly endpoint = 'https://overpass-api.de/api/interpreter';
  private readonly timeoutMs = 25000; // 25s

  private buildQuery(bbox: Bbox): string {
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

  public async fetchAndStoreMarkets(bbox: Bbox): Promise<Marketplace[]> {
    const query = this.buildQuery(bbox);
    let response;
    try {
      response = await axios.post(this.endpoint, query, {
        headers: { 'Content-Type': 'text/plain' },
        timeout: this.timeoutMs,
      });
    } catch (err: any) {
      if (err?.code === 'ECONNABORTED') {
        throw new Error('Overpass request timed out');
      }
      throw new Error('Failed to contact Overpass API');
    }

    const elements: any[] = response.data?.elements || [];

    // Build node map for centroid calculation
    const nodeMap = new Map<number, { lat: number; lon: number }>();
    for (const el of elements) {
      if (el.type === 'node') {
        nodeMap.set(el.id, { lat: el.lat, lon: el.lon });
      }
    }

    const repo = AppDataSource.getRepository(Marketplace);
    const results: Marketplace[] = [];

    for (const el of elements) {
      if (!el.tags || el.tags['amenity'] !== 'marketplace') continue;

      let lat: number | null = null;
      let lon: number | null = null;

      if (el.type === 'node') {
        lat = el.lat;
        lon = el.lon;
      } else if (el.type === 'way' && Array.isArray(el.nodes)) {
        const coords = el.nodes
          .map((nid: number) => nodeMap.get(nid))
          .filter(Boolean);
        if (coords.length) {
          lat = coords.reduce((s: number, c: any) => s + c.lat, 0) / coords.length;
          lon = coords.reduce((s: number, c: any) => s + c.lon, 0) / coords.length;
        }
      } else if (el.type === 'relation' && Array.isArray(el.members)) {
        const coords = el.members
          .filter((m: any) => m.type === 'node' && nodeMap.has(m.ref))
          .map((m: any) => nodeMap.get(m.ref))
          .filter(Boolean);
        if (coords.length) {
          lat = coords.reduce((s: number, c: any) => s + c.lat, 0) / coords.length;
          lon = coords.reduce((s: number, c: any) => s + c.lon, 0) / coords.length;
        }
      }

      const osmId = `${el.type}:${el.id}`;
      const tags = el.tags || {};
      const name = tags.name || null;
      const city = tags['addr:city'] || tags.is_in || null;

      // upsert-like behavior: find existing by osm_id
      let existing = await repo.findOne({ where: { osm_id: osmId } });
      if (existing) {
        existing.name = name || existing.name;
        existing.latitude = lat ?? existing.latitude;
        existing.longitude = lon ?? existing.longitude;
        existing.tags = tags;
        existing.city = city || existing.city;
        existing.fetched_at = new Date();
        existing = await repo.save(existing);
        results.push(existing);
      } else {
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
