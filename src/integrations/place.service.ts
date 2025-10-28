import axios from 'axios';

export interface CityBBox {
  south: number;
  west: number;
  north: number;
  east: number;
  display_name?: string;
}

export class PlaceService {
  private readonly endpoint = 'https://nominatim.openstreetmap.org/search';
  private readonly timeoutMs = 10000;

  async getCityBBox(city: string): Promise<CityBBox> {
    try {
      const resp = await axios.get(this.endpoint, {
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
      // Nominatim boundingbox: [south, north, west, east]
      const bb = first.boundingbox;
      if (!bb || bb.length < 4) throw new Error('invalid_response');

      const south = parseFloat(bb[0]);
      const north = parseFloat(bb[1]);
      const west = parseFloat(bb[2]);
      const east = parseFloat(bb[3]);

      return { south, west, north, east, display_name: first.display_name };
    } catch (err: any) {
      if (err?.message === 'not_found') throw err;
      // normalize axios timeout
      if (err?.code === 'ECONNABORTED') throw new Error('timeout');
      throw new Error('service_error');
    }
  }
}
