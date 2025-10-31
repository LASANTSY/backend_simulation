(async () => {
  try {
    const ctx = require('../src/context/context.service').default;
    const place = require('../src/integrations/place.service').PlaceService;
    const ps = new place();
    const city = process.argv[2] || 'Antananarivo';
    console.log('City:', city);
    const info = await ps.getCityInfo(city);
    console.log('City info:', info);
    const countryKey = info.address?.country_code ?? info.address?.country;
    console.log('Country key from Nominatim:', countryKey);
    try {
      const dem = await ctx.fetchDemographics(countryKey);
      console.log('Demographics (restcountries):', Array.isArray(dem) ? dem[0] : dem);
    } catch (e) {
      console.error('fetchDemographics error:', e.message || e);
    }

    const countryForIndicators = (async () => {
      try {
        const dem = await ctx.fetchDemographics(countryKey);
        if (Array.isArray(dem) && dem.length > 0) return dem[0].cca3 || dem[0].cca2;
        if (dem && dem.cca3) return dem.cca3;
      } catch (e) {}
      return countryKey?.toUpperCase();
    })();

    const cfi = await countryForIndicators;
    console.log('Country for indicators:', cfi);

    try {
      const pop = await ctx.fetchEconomicIndicator(cfi, 'SP.POP.TOTL');
      console.log('WorldBank population sample:', Array.isArray(pop) ? pop[0] : pop);
    } catch (e) {
      console.error('fetchEconomicIndicator error:', e.message || e);
    }

    // Attempt weather
    try {
      const weather = await ctx.fetchWeather(info.lat, info.lon);
      console.log('Weather sample keys:', Object.keys(weather || {}).slice(0, 10));
    } catch (e) {
      console.error('fetchWeather error:', e.message || e);
    }
  } catch (err) {
    console.error('Script error', err);
  }
})();
