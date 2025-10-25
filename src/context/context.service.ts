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
      // persist
      const ent = this.weatherRepo.create({ key, data } as any);
      await this.weatherRepo.save(ent as any);
      this.cache.set(key, data);
      return data;
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
    // If the template contains placeholders, replace them. Otherwise treat it as a base URL.
    let url: string;
    if (urlTemplate.includes('{country}') && urlTemplate.includes('{indicator}')) {
      url = urlTemplate.replace('{country}', encodeURIComponent(countryCode)).replace('{indicator}', encodeURIComponent(indicator));
    } else if (envProvided && urlTemplate.startsWith('http')) {
      // env contains a base URL (e.g. https://api.worldbank.org/v2/indicators), append path
      url = `${urlTemplate.replace(/\/$/, '')}/country/${encodeURIComponent(countryCode)}/indicator/${encodeURIComponent(indicator)}?format=json&per_page=100`;
    } else {
      // fallback to default
      url = `https://api.worldbank.org/v2/country/${countryCode}/indicator/${indicator}?format=json&per_page=100`;
    }
    try {
      const resp = await axios.get(url, { timeout: 10000 });
      const data = resp.data;
      const ent = this.econRepo.create({ country: countryCode, indicator, data } as any);
      await this.econRepo.save(ent as any);
      this.cache.set(key, data);
      return data;
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

    const url = `https://restcountries.com/v3.1/name/${encodeURIComponent(countryCodeOrName)}`;
    try {
      const resp = await axios.get(url, { timeout: 10000 });
      const data = resp.data;
      const ent = this.demoRepo.create({ country: countryCodeOrName, data } as any);
      await this.demoRepo.save(ent as any);
      this.cache.set(key, data);
      return data;
    } catch (err) {
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
