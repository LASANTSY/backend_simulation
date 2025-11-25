import express, { Request, Response } from 'express';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateSimulationDto } from './dto/create-simulation.dto';
import simulationService from './simulation.service';
import buildOptimizedResponse from './response.mapper';
import { PlaceService } from '../integrations/place.service';
import contextService from '../context/context.service';

const router = express.Router();
const placeService = new PlaceService();

// POST /simulations -> create and run simulation
router.post('/simulations', async (req: Request, res: Response) => {
  const dto = plainToInstance(CreateSimulationDto, req.body);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: false });
  if (errors.length > 0) return res.status(400).json({ errors });

  try {
    // If contexts are not provided, attempt to fetch them automatically using the provided city
    let weatherContext = dto.weatherContext;
    let economicContext = dto.economicContext;
    let demographicContext = dto.demographicContext;
    let seasonContext = dto.seasonContext;

    if ((!weatherContext || !economicContext || !demographicContext || !seasonContext) && dto.city) {
      try {
        console.log('[Simulation Controller] Fetching contexts for city:', dto.city);
        const info = await placeService.getCityInfo(dto.city);
        const lat = info.lat;
        const lon = info.lon;
        console.log('[Simulation Controller] City info:', { lat, lon, country: info.address?.country_code });

        // Derive a country identifier usable by World Bank/IMF.
        // Nominatim returns address.country_code (alpha-2) or address.country (name).
        // World Bank prefers ISO3 (e.g. MDG). Use fetchDemographics to translate alpha-2/name -> cca3 when possible.
        let countryForIndicators: string | undefined = undefined;
        try {
          const countryKey = info.address?.country_code ?? info.address?.country;
          if (countryKey) {
            const dem = await contextService.fetchDemographics(countryKey);
            // restcountries returns an array; try to extract cca3 or cca2
            if (Array.isArray(dem) && dem.length > 0) {
              const c0 = dem[0];
               countryForIndicators = c0?.cca2 ?? c0?.cca3 ?? c0?.cca1 ?? undefined;
            } else if (dem && dem.cca3) {
               countryForIndicators = dem.cca2 ?? dem.cca3;
            }
          }
        } catch (demErr) {
          console.warn('[Simulation Controller] Demographics fetch for country resolution failed:', demErr);
          // non-fatal: fall back to raw country name or alpha-2 uppercased
          countryForIndicators = info.address?.country_code ? info.address.country_code.toUpperCase() : info.address?.country;
        }

        console.log('[Simulation Controller] Country for indicators:', countryForIndicators);
        const simPlaceholder: any = { parameters: { location: { lat, lon }, country: countryForIndicators ?? info.address?.country, startDate: dto.startDate } };
        const fetched = await contextService.fetchContextForSimulation(simPlaceholder);
        console.log('[Simulation Controller] Fetched contexts:', {
          hasWeather: !!fetched.weather,
          hasEconomic: !!fetched.economic,
          hasDemographics: !!fetched.demographics,
          hasSeason: !!fetched.season,
          errors: fetched._errors
        });
        weatherContext = weatherContext ?? fetched.weather ?? null;
        economicContext = economicContext ?? fetched.economic ?? fetched.economy ?? null;
        demographicContext = demographicContext ?? fetched.demographics ?? null;
        seasonContext = seasonContext ?? (fetched.season ? { season: fetched.season } : null);
        console.log('[Simulation Controller] Final contexts to pass:', {
          hasWeather: !!weatherContext,
          hasEconomic: !!economicContext,
          hasDemographics: !!demographicContext,
          hasSeason: !!seasonContext
        });
        // Persist context fetch metadata for troubleshooting
        (req as any)._contextFetchInfo = { cityInfo: info, fetched };
      } catch (e) {
        console.warn('Context auto-fetch failed:', e);
        // continue: simulation can still run with missing contexts (service handles nulls)
      }
    } else {
      console.log('[Simulation Controller] Skipping context fetch. City provided:', !!dto.city, 'Contexts already present:', {
        weather: !!weatherContext,
        economic: !!economicContext,
        demographic: !!demographicContext,
        season: !!seasonContext
      });
    }

    const result = await simulationService.createAndRunSimulation({
      revenueId: dto.revenueId,
      newAmount: dto.newAmount,
      frequency: dto.frequency,
      durationMonths: dto.durationMonths,
      startDate: dto.startDate,
      note: dto.note,
      // currency / devise: prefer provided, else env DEFAULT_CURRENCY, else 'MGA'
      devise: dto.devise ?? process.env.DEFAULT_CURRENCY ?? 'MGA',
      weatherContext,
      economicContext,
      demographicContext,
      seasonContext,
      city: dto.city,  // ✅ Passer la ville depuis la requête HTTP
    });
    // Decide response mode: default = optimized; raw available via ?raw=true
    const wantRaw = String(req.query.raw || '').toLowerCase() === 'true' || String(req.headers['x-response-mode'] || '').toLowerCase() === 'raw';
    if (wantRaw) {
      // If debug info was attached during context fetch, include it in the response when running in non-production
      const debugInfo = (req as any)._contextFetchInfo;
      if (debugInfo && (process.env.NODE_ENV !== 'production')) {
        (result as any)._debug = { contextFetch: debugInfo };
      }
      return res.status(201).json(result);
    }

    const optimized = buildOptimizedResponse(result as any);
    return res.status(201).json(optimized);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Simulation failed', error: String(err) });
  }
});

// GET /simulations
router.get('/simulations', async (req: Request, res: Response) => {
  const municipalityId = (req.query.municipalityId as string) || undefined;
  const sims = await simulationService.findAllSimulations(municipalityId);
  res.json(sims);
});

// GET /simulations/:id
router.get('/simulations/:id', async (req: Request, res: Response) => {
  const id = req.params.id;
  const s = await simulationService.findSimulation(id);
  if (!s) return res.status(404).json({ message: 'Not found' });
  res.json(s);
});

// GET /analysis-results (all)
router.get('/analysis-results', async (_req: Request, res: Response) => {
  const repo = (await import('../data-source')).default.getRepository('AnalysisResult' as any);
  const items = await repo.find({ order: { createdAt: 'DESC' } });
  res.json(items);
});

export default router;

// Debug endpoint: fetch context for a city (only enabled when NODE_ENV !== 'production')
router.get('/_debug/context', async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') return res.status(403).json({ message: 'Forbidden in production' });
  const city = (req.query.city as string) || (req.query.ville as string);
  if (!city) return res.status(400).json({ message: 'city query parameter is required' });

  try {
    const info = await placeService.getCityInfo(city);
    const lat = info.lat;
    const lon = info.lon;
    // try to derive country code
    let countryForIndicators: string | undefined = undefined;
    try {
      const countryKey = info.address?.country_code ?? info.address?.country;
      if (countryKey) {
        const dem = await contextService.fetchDemographics(countryKey);
        if (Array.isArray(dem) && dem.length > 0) {
          const c0 = dem[0];
          countryForIndicators = c0?.cca3 ?? c0?.cca2 ?? undefined;
        } else if (dem && dem.cca3) {
          countryForIndicators = dem.cca3;
        }
      }
    } catch (e) {
      countryForIndicators = info.address?.country_code ? info.address.country_code.toUpperCase() : info.address?.country;
    }

    const simPlaceholder: any = { parameters: { location: { lat, lon }, country: countryForIndicators ?? info.address?.country, startDate: req.query.startDate as string } };
    const fetched = await contextService.fetchContextForSimulation(simPlaceholder);
    res.json({ cityInfo: info, countryForIndicators, fetched });
  } catch (err: any) {
    console.error('Debug context fetch error', err);
    res.status(500).json({ message: 'Debug fetch failed', error: String(err) });
  }
});
