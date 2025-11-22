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

  // Get richer city info including lat/lon and address object when available
  async getCityInfo(city: string): Promise<{ lat: number; lon: number; display_name?: string; address?: any }> {
    // Retry a few times for transient network/server errors, and provide richer error info
    const maxAttempts = 3;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    let lastErr: any = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const resp = await axios.get(this.endpoint, {
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
        if (!Array.isArray(data) || data.length === 0) throw new Error('not_found');
        const first = data[0];
        const lat = parseFloat(first.lat);
        const lon = parseFloat(first.lon);
        return { lat, lon, display_name: first.display_name, address: first.address };
      } catch (err: any) {
        lastErr = err;
        if (err?.message === 'not_found') throw err;
        if (err?.code === 'ECONNABORTED') {
          // timeout: if last attempt, surface timeout, else retry
          if (attempt === maxAttempts) throw new Error('timeout');
          await sleep(200 * attempt);
          continue;
        }

        const status = err?.response?.status;
        // Retry on 5xx server errors
        if (status && status >= 500 && attempt < maxAttempts) {
          await sleep(250 * attempt);
          continue;
        }

        // Non-retriable or final attempt: include response details when present
        const statusInfo = status ? `status=${status}` : `code=${err?.code ?? 'unknown'}`;
        const body = err?.response?.data ? ` body=${JSON.stringify(err.response.data)}` : '';
        const message = `service_error: ${err?.message ?? 'unknown'} (${statusInfo})${body}`;
        throw new Error(message);
      }
    }

    // If we exit loop without returning, throw an informative error
    throw new Error(`service_error: ${lastErr?.message ?? 'unknown'}`);
  }
}
