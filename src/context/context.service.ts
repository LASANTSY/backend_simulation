import NodeCache from 'node-cache';
import axios from 'axios';
import AppDataSource from '../data-source';
import { WeatherContext } from '../entities/WeatherContext';
import { EconomicIndicator } from '../entities/EconomicIndicator';
import { Demographic } from '../entities/Demographic';
import * as dotenv from 'dotenv';

dotenv.config();

const WEATHER_KEY = process.env.OPENWEATHER_API_KEY || '';
const CACHE_TTL = parseInt(process.env.CONTEXT_CACHE_TTL || '3600', 10); // seconds

// External API endpoints (can be full URLs provided in .env)
// Prefer explicit *_URL variables for templates; keep backward compatibility with older *_API_KEY names if present.
const WB_INDICATOR_URL = process.env.WB_INDICATOR_URL || process.env.WB_INDICATOR_API_KEY || 'https://api.worldbank.org/v2/country/{country}/indicator/{indicator}?format=json&per_page=100';
const WB_COUNTRY_URL = process.env.WB_COUNTRY_URL || process.env.WB_COUNTRY_API_KEY || 'https://api.worldbank.org/v2/country/{country}/indicator?format=json';
const IMF_INDICATOR_URL = process.env.IMF_INDICATOR_URL || process.env.IMF_INDICATOR_API_KEY || '';
const IMF_COUNTRY_URL = process.env.IMF_COUNTRY_URL || process.env.IMF_COUNTRY_API_KEY || '';
const IMF_API_KEY = process.env.IMF_INDICATOR_API_KEY || process.env.IMF_API_KEY || '';

export class ContextService {
  private cache = new NodeCache({ stdTTL: CACHE_TTL, checkperiod: 120 });
  private weatherRepo = AppDataSource.getRepository(WeatherContext);
  private econRepo = AppDataSource.getRepository(EconomicIndicator);
  private demoRepo = AppDataSource.getRepository(Demographic);

  // fetch weather from OpenWeatherMap (onecall/timemachine or current)
  async fetchWeather(lat: number, lon: number, date?: string) {
    const key = `${lat}_${lon}_${date || 'current'}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    // check DB cache
    const db = await this.weatherRepo.findOneBy({ key });
    if (db) {
      this.cache.set(key, db.data);
      return db.data;
    }

    if (!WEATHER_KEY) throw new Error('OPENWEATHER_API_KEY not configured');

    // If date provided and within last 5 days, use timemachine endpoint. Otherwise use current weather.
    let url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${WEATHER_KEY}&units=metric`;
    try {
      const resp = await axios.get(url, { timeout: 10000 });
      const data = resp.data;
      // persist full payload for audit, but return and cache a compact version
      const ent = this.weatherRepo.create({ key, data } as any);
      await this.weatherRepo.save(ent as any);

      const compact = {
        location: data.name,
        temp: data?.main?.temp ?? null,
        description: Array.isArray(data?.weather) && data.weather.length > 0 ? data.weather[0].description : null,
        humidity: data?.main?.humidity ?? null,
        // include simple coords only
        coords: data?.coord ? { lat: data.coord.lat, lon: data.coord.lon } : null,
      };

      this.cache.set(key, compact);
      return compact;
    } catch (err) {
      throw new Error('Weather fetch failed: ' + String(err));
    }
  }

  // Fetch an economic indicator from World Bank API (no key needed)
  // indicator like 'SP.POP.TOTL' or 'NY.GDP.MKTP.CD'
  async fetchEconomicIndicator(countryCode: string, indicator: string) {
    const key = `${countryCode}_${indicator}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const db = await this.econRepo.findOneBy({ country: countryCode, indicator });
    if (db) {
      this.cache.set(key, db.data);
      return db.data;
    }

    // build URL from env template if provided
    let urlTemplate = WB_INDICATOR_URL;
    const envProvided = !!process.env.WB_INDICATOR_API_KEY;
    // Build a usable URL from the template or fallback to the standard World Bank API
    let url: string;
    if (urlTemplate && urlTemplate.includes('{country}') && urlTemplate.includes('{indicator}')) {
      url = urlTemplate.replace('{country}', encodeURIComponent(countryCode)).replace('{indicator}', encodeURIComponent(indicator));
    } else if (urlTemplate && urlTemplate.startsWith('http')) {
      // if user provided a base URL, append a plausible path
      url = `${urlTemplate.replace(/\/$/, '')}/country/${encodeURIComponent(countryCode)}/indicator/${encodeURIComponent(indicator)}?format=json&per_page=100`;
    } else {
      url = `https://api.worldbank.org/v2/country/${encodeURIComponent(countryCode)}/indicator/${encodeURIComponent(indicator)}?format=json&per_page=100`;
    }

    try {
      console.log(`[ContextService] fetchEconomicIndicator: requesting URL: ${url}`);
      const resp = await axios.get(url, { timeout: 10000, headers: { Accept: 'application/json' } });
      let data = resp.data;

      // If World Bank returned XML (error), retry with default template and explicit Accept header
      if (typeof data === 'string' && /<\?xml|<wb:error/i.test(data)) {
        console.warn('[ContextService] fetchEconomicIndicator: received XML response, retrying with fallback URL');
        const fallback = `https://api.worldbank.org/v2/country/${encodeURIComponent(countryCode)}/indicator/${encodeURIComponent(indicator)}?format=json&per_page=100`;
        console.log(`[ContextService] fetchEconomicIndicator: retrying with ${fallback}`);
        const resp2 = await axios.get(fallback, { timeout: 10000, headers: { Accept: 'application/json' } });
        data = resp2.data;
      }

      // World Bank returns an array: [metadata, dataArray]
      let reduced: any = data;
      if (Array.isArray(data) && data.length >= 2 && Array.isArray(data[1])) {
        const dataArray = data[1];
        // pick up to 3 most recent non-null years
        const recentYears = 3;
        const recent: Array<{ date: string; value: number | null }> = [];
        for (const entry of dataArray) {
          if (recent.length >= recentYears) break;
          if (entry && typeof entry.date !== 'undefined') {
            recent.push({ date: entry.date, value: entry.value ?? null });
          }
        }
        reduced = { country: countryCode, indicator, recent };
      }

      // persist full payload but cache/return the reduced shape to clients
      const ent = this.econRepo.create({ country: countryCode, indicator, data } as any);
      await this.econRepo.save(ent as any);
      this.cache.set(key, reduced);
      return reduced;
    } catch (err) {
      throw new Error('Economic indicator fetch failed (' + url + '): ' + String(err));
    }
  }
  // Fetch an economic indicator from IMF API if configured. The IMF env variables may contain
  // either a full URL template with {country} and {indicator} placeholders or a base URL.
  // If an API key is required, include it as a query parameter named 'api_key' unless the
  // provided template already contains it.
  async fetchIMFIndicator(countryCode: string, indicator: string) {
    if (!IMF_INDICATOR_URL) {
      throw new Error('IMF_INDICATOR_URL not configured');
    }

    const key = `imf_${countryCode}_${indicator}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const db = await this.econRepo.findOneBy({ country: countryCode, indicator: `IMF:${indicator}` });
    if (db) {
      this.cache.set(key, db.data);
      return db.data;
    }

    let urlTemplate = IMF_INDICATOR_URL;
    const envProvided = !!IMF_INDICATOR_URL;
    let url: string;
    if (urlTemplate.includes('{country}') && urlTemplate.includes('{indicator}')) {
      url = urlTemplate.replace('{country}', encodeURIComponent(countryCode)).replace('{indicator}', encodeURIComponent(indicator));
    } else if (envProvided && urlTemplate.startsWith('http')) {
      // Try to append a plausible path. IMF APIs differ by provider; user can supply full template for accuracy.
      url = `${urlTemplate.replace(/\/$/, '')}/country/${encodeURIComponent(countryCode)}/indicator/${encodeURIComponent(indicator)}`;
    } else {
      // As a last resort, call the provided urlTemplate directly
      url = urlTemplate;
    }

    // If api key present in env and not included in template, append it as api_key (or the user's preferred param)
    const hasQuery = url.includes('?');
    if (IMF_API_KEY && !/api_key=/.test(url)) {
      url = `${url}${hasQuery ? '&' : '?'}api_key=${encodeURIComponent(IMF_API_KEY)}&format=json`;
    } else if (!url.includes('?')) {
      url = `${url}?format=json`;
    }

    try {
      const resp = await axios.get(url, { timeout: 12000 });
      const data = resp.data;
      const ent = this.econRepo.create({ country: countryCode, indicator: `IMF:${indicator}`, data } as any);
      await this.econRepo.save(ent as any);
      this.cache.set(key, data);
      return data;
    } catch (err) {
      throw new Error('IMF indicator fetch failed (' + url + '): ' + String(err));
    }
  }

  // Fetch demographic info via restcountries (as fallback)
  async fetchDemographics(countryCodeOrName: string) {
    const key = `demo_${countryCodeOrName}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const db = await this.demoRepo.findOneBy({ country: countryCodeOrName });
    if (db) {
      this.cache.set(key, db.data);
      return db.data;
    }

    // If the input looks like an ISO code (2 or 3 letters), use the /alpha endpoint
    const codeMatch = typeof countryCodeOrName === 'string' && /^[A-Za-z]{2,3}$/.test(countryCodeOrName.trim());
    const base = 'https://restcountries.com/v3.1';
    const url = codeMatch
      ? `${base}/alpha/${encodeURIComponent(countryCodeOrName.trim())}`
      : `${base}/name/${encodeURIComponent(countryCodeOrName)}`;

    try {
      const resp = await axios.get(url, { timeout: 10000 });
      const data = resp.data;
      // pick first entry if array
      const entry = Array.isArray(data) ? data[0] : data;
      // persist full payload but return a compact demographics shape
      const ent = this.demoRepo.create({ country: countryCodeOrName, data } as any);
      await this.demoRepo.save(ent as any);

      const essential = {
        country: entry?.name?.common ?? entry?.name ?? countryCodeOrName,
        capital: Array.isArray(entry?.capital) && entry.capital.length > 0 ? entry.capital[0] : null,
        languages: entry?.languages ? Object.values(entry.languages) : [],
        gini: entry?.gini ? Object.values(entry.gini)[0] ?? null : null,
        region: entry?.region ?? null,
        population: entry?.population ?? null,
      };

      this.cache.set(key, essential);
      return essential;
    } catch (err: any) {
      throw new Error('Demographics fetch failed: ' + String(err));
    }
  }

  // Convenience: build a context object for a simulation (attempt to infer country/lat/lon from revenue.parameters)
  async fetchContextForSimulation(simulation: any) {
    try {
      const params = simulation?.parameters || {};
      const ctx: any = {};
      if (params.location && params.location.lat && params.location.lon) {
        ctx.weather = await this.fetchWeather(params.location.lat, params.location.lon, params.startDate);
      }
      if (params.country) {
        ctx.economic = {};
        // example indicators: population (SP.POP.TOTL), gdp (NY.GDP.MKTP.CD)
        ctx.economic.population = await this.fetchEconomicIndicator(params.country, 'SP.POP.TOTL');
        ctx.economic.gdp = await this.fetchEconomicIndicator(params.country, 'NY.GDP.MKTP.CD');
        // Try IMF as an additional source if configured
        try {
          ctx.economic.imf_gdp = await this.fetchIMFIndicator(params.country, 'NGDP_RPCH');
        } catch (e) {
          // non-fatal, keep worldbank data
        }
        ctx.demographics = await this.fetchDemographics(params.country);
      }
      // season inference
      if (params.startDate) {
        const d = new Date(params.startDate);
        const month = d.getMonth() + 1;
        const season = month >= 3 && month <= 5 ? 'spring' : month >= 6 && month <= 8 ? 'summer' : month >= 9 && month <= 11 ? 'autumn' : 'winter';
        ctx.season = season;
      }
      return ctx;
    } catch (err) {
      return { _error: String(err) };
    }
  }
}

export default new ContextService();
