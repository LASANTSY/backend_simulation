const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Documentation API - Service prédiction',
    version: '0.1.0',
    description: 'API pour la gestion des recettes, simulations et previsions. Les routes sont exposees sous /serviceprediction.',
  },
  // Use root server so paths include the full /serviceprediction prefix explicitly
  servers: [{ url: '/', description: 'Serveur local (root) — les paths incluent /serviceprediction' }],
  tags: [
    { name: 'revenue', description: 'Gestion des recettes (CRUD)' },
    { name: 'prediction', description: 'Calculs et stockage des previsions' },
    { name: 'simulation', description: "Scenarios et analyses d'impact (IA integree)" },
    { name: 'integrations', description: 'Integrations externes (transactions, passerelles)' },
    { name: 'ai', description: 'Enrichissement automatique via IA' },
    { name: 'optimization', description: 'Optimisation du timing' },
  ],
  paths: {
  '/serviceprediction/markets': {
      get: {
        tags: ['integrations'],
        summary: "Lister les marketplaces via Overpass (OpenStreetMap)",
        description: 'Recupere les objets amenity=marketplace dans la bounding box fournie et les enregistre localement.',
        parameters: [
          { name: 'city', in: 'query', required: false, schema: { type: 'string' }, description: 'Nom de la ville a associer aux resultats (optionnel) - forcera la valeur enregistrée' },
          { name: 'south', in: 'query', required: true, schema: { type: 'number' }, description: 'Latitude sud (min) - format decimal' },
          { name: 'west', in: 'query', required: true, schema: { type: 'number' }, description: 'Longitude ouest (min) - format decimal' },
          { name: 'north', in: 'query', required: true, schema: { type: 'number' }, description: 'Latitude nord (max) - format decimal' },
          { name: 'east', in: 'query', required: true, schema: { type: 'number' }, description: 'Longitude est (max) - format decimal' },
        ],
        responses: {
          '200': { description: 'Liste des marketplaces', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Marketplace' } } } } },
          '400': { description: 'Parametres de requete invalides' },
          '502': { description: 'Erreur lors de l appel a l API Overpass' },
        },
      },
    },
  '/serviceprediction/markets/stored': {
      get: {
        tags: ['integrations'],
        summary: 'Recuperer les marketplaces enregistres localement',
        parameters: [
          { name: 'city', in: 'query', required: false, schema: { type: 'string' }, description: 'Filtrer par nom de ville' },
          { name: 'since', in: 'query', required: false, schema: { type: 'string', format: 'date-time' }, description: 'Recuperer les enregistrements depuis cette date (ISO)' },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer' }, description: 'Nombre maximum d elements a renvoyer' },
          { name: 'south', in: 'query', required: false, schema: { type: 'number' }, description: 'Latitude sud (min)' },
          { name: 'west', in: 'query', required: false, schema: { type: 'number' }, description: 'Longitude ouest (min)' },
          { name: 'north', in: 'query', required: false, schema: { type: 'number' }, description: 'Latitude nord (max)' },
          { name: 'east', in: 'query', required: false, schema: { type: 'number' }, description: 'Longitude est (max)' },
        ],
        responses: {
          '200': { description: 'Liste des marketplaces enregistres', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Marketplace' } } } } },
          '400': { description: 'Parametres invalides' },
          '500': { description: 'Erreur serveur' },
        },
      },
    },
  '/serviceprediction/places/bbox': {
      get: {
        tags: ['integrations'],
        summary: "Recuperer le bounding box d'une ville via OSM (Nominatim)",
        parameters: [
          { name: 'city', in: 'query', required: true, schema: { type: 'string' }, description: 'Nom de la ville (ex: Antananarivo)' },
        ],
        responses: {
          '200': { description: 'Bounding box de la ville', content: { 'application/json': { schema: { $ref: '#/components/schemas/CityBBox' } } } },
          '400': { description: 'Parametres invalides' },
          '404': { description: 'Ville non trouvée' },
          '502': { description: 'Erreur fournisseur externe' },
        },
      },
    },
  '/serviceprediction/markets/by-city': {
      get: {
        tags: ['integrations'],
        summary: 'Recuperer et normaliser les marketplaces pour une ville (places+bbox -> markets)',
        parameters: [
          { name: 'ville', in: 'query', required: true, schema: { type: 'string' }, description: 'Nom de la ville (ex: Mahajanga)' },
        ],
        responses: {
          '200': { description: 'Liste normalisee des marketplaces', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/MarketplaceNormalized' } } } } },
          '400': { description: 'Parametres invalides' },
          '404': { description: 'Ville non trouvee' },
          '502': { description: 'Erreur lors de la recuperation des marches' },
        },
      },
    },
    '/serviceprediction/markets/normalized': {
        get: {
          tags: ['integrations'],
          summary: "Afficher les marketplaces normalisees (nom, ville, delimitation GeoJSON)",
          parameters: [
            { name: 'city', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'since', in: 'query', required: false, schema: { type: 'string', format: 'date-time' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'integer' } },
            { name: 'south', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'west', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'north', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'east', in: 'query', required: false, schema: { type: 'number' } },
          ],
          responses: {
            '200': { description: 'Liste normalisee', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/MarketplaceNormalized' } } } } },
            '400': { description: 'Parametres invalides' },
            '500': { description: 'Erreur serveur' },
          },
        },
      },
  '/serviceprediction/predictions/run': {
      post: {
        tags: ['prediction'],
        summary: "Lancer les previsions a partir des transactions d'une municipalite",
        description: 'Recupere les transactions pour la municipalite fournie, calcule les previsions et enregistre les resultats.',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/PredictionRunDto' } },
          },
        },
        responses: {
          '200': { description: 'Previsions calculees et enregistrees' },
          '400': { description: 'Requete invalide' },
          '502': { description: 'Erreur fournisseur externe' },
        },
      },
    },

  '/serviceprediction/external/transactions/{municipalityId}': {
      get: {
        tags: ['integrations'],
        summary: 'Proxy - obtenir les transactions pour une municipalite',
        parameters: [{ name: 'municipalityId', in: 'path', required: true, schema: { type: 'string' }, description: 'Identifiant de la municipalite' }],
        responses: { '200': { description: 'Donnees renvoyees' }, '502': { description: 'Erreur passerelle' } },
      },
    },

  '/serviceprediction/revenues': {
      get: {
        tags: ['revenue'],
        summary: 'Lister les recettes',
        parameters: [
          { name: 'municipalityId', in: 'query', required: false, schema: { type: 'string' }, description: 'Filtrer par identifiant de municipalité' },
        ],
        responses: { '200': { description: 'Liste des recettes' } },
      },
      post: { tags: ['revenue'], summary: 'Creer une recette', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateRevenueDto' } } } }, responses: { '201': { description: 'Recette creee' } } },
    },

  '/serviceprediction/revenues/{id}': {
      get: { tags: ['revenue'], summary: 'Recuperer une recette', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' }, '404': { description: 'Non trouve' } } },
      put: { tags: ['revenue'], summary: 'Mettre a jour une recette', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateRevenueDto' } } } }, responses: { '200': { description: 'Mis a jour' } } },
      delete: { tags: ['revenue'], summary: 'Supprimer une recette', responses: { '204': { description: 'Supprime' } } },
    },

  '/serviceprediction/predictions': {
      get: {
        tags: ['prediction'],
        summary: 'Lister les previsions enregistrees',
        parameters: [
          { name: 'municipalityId', in: 'query', required: false, schema: { type: 'string' }, description: 'Filtrer par identifiant de municipalité' },
        ],
        responses: { '200': { description: 'OK' } },
      },
    },

  '/serviceprediction/simulations': {
      post: { tags: ['simulation'], summary: 'Creer et executer une simulation (IA integree)', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateSimulationDto' } } } }, responses: { '201': { description: 'Simulation creee et enrichie' }, '400': { description: 'Requete invalide' } } },
      get: {
        tags: ['simulation'],
        summary: 'Lister les simulations',
        parameters: [
          { name: 'municipalityId', in: 'query', required: false, schema: { type: 'string' }, description: 'Filtrer par identifiant de municipalité' },
        ],
        responses: { '200': { description: 'OK' } },
      },
    },

  '/serviceprediction/simulations/{id}': { get: { tags: ['simulation'], summary: 'Recuperer une simulation', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' }, '404': { description: 'Non trouve' } } } },

  '/serviceprediction/simulations/{id}/optimize': { post: { tags: ['optimization'], summary: 'Optimiser le timing pour une simulation donnee', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Recommandations' }, '400': { description: 'Mauvaise requete' } } } },

  '/serviceprediction/analysis-results/{id}/enrich': { post: { tags: ['ai'], summary: 'Enrichir un resultat (pour usage direct)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Analyse enrichie' }, '500': { description: 'Erreur IA' } } } },
  },

  components: {
    schemas: {
      CreateRevenueDto: {
        type: 'object',
        properties: { amount: { type: 'number' }, date: { type: 'string', format: 'date' }, category: { type: 'string' }, source: { type: 'string' }, parameters: { type: 'object' } },
        required: ['amount', 'date', 'category'],
        example: { amount: 1500.5, date: '2025-01-15', category: 'taxe', source: 'guichet' },
      },

      UpdateRevenueDto: { type: 'object', properties: { amount: { type: 'number' }, date: { type: 'string', format: 'date' }, category: { type: 'string' }, source: { type: 'string' }, parameters: { type: 'object' } } },

      PredictionRunDto: { type: 'object', properties: { municipalityId: { type: 'string' }, months: { type: 'integer' }, years: { type: 'integer' }, period: { type: 'string', enum: ['monthly', 'annual', 'both'] } }, required: ['municipalityId'] },

      CreateSimulationDto: {
        type: 'object',
        description: 'Creer une simulation avec contextes injectes (weather, economic, demographic).',
        properties: {
          revenueId: { type: 'string', format: 'uuid' },
          newAmount: { type: 'number' },
          frequency: { type: 'string', enum: ['monthly', 'annual'] },
          durationMonths: { type: 'integer' },
          startDate: { type: 'string', format: 'date' },
          note: { type: 'string' },
          weatherContext: { type: 'object', description: 'Contexte meteo (temp, precipitation, events, ...)' },
          economicContext: { type: 'object', description: 'Contexte economique (gdp, inflation, revenues, ...)' },
          demographicContext: { type: 'object', description: 'Contexte demographique (population, medianAge, density, ...)' },
        },
        required: ['revenueId', 'newAmount', 'frequency', 'durationMonths', 'weatherContext', 'economicContext', 'demographicContext'],
        example: { revenueId: 'uuid', newAmount: 2000, frequency: 'monthly', durationMonths: 12, startDate: '2025-06-01', note: 'Test', weatherContext: { temp: 25 }, economicContext: { gdp: 1e9 }, demographicContext: { population: 100000 } },
      },

      Simulation: { type: 'object', properties: { id: { type: 'string' }, parameters: { type: 'object' }, status: { type: 'string' }, weatherContext: { type: 'object' }, economicContext: { type: 'object' }, demographicContext: { type: 'object' }, createdAt: { type: 'string', format: 'date-time' } } },

      AnalysisResult: { type: 'object', properties: { id: { type: 'string' }, simulationId: { type: 'string' }, resultData: { type: 'object' }, summary: { type: 'string' }, createdAt: { type: 'string', format: 'date-time' } } },

      Transaction: { type: 'object', properties: { transactionId: { type: 'string' }, amount: { type: 'number' }, date: { type: 'string', format: 'date' }, status: { type: 'string' } } },

      TransactionProviderResponse: { type: 'object', properties: { message: { type: 'string' }, status: { type: 'number' }, data: { type: 'array', items: { $ref: '#/components/schemas/Transaction' } } } },
      Marketplace: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          osm_id: { type: 'string' },
          name: { type: 'string' },
          latitude: { type: 'number' },
          longitude: { type: 'number' },
          tags: { type: 'object' },
          city: { type: 'string' },
          fetched_at: { type: 'string', format: 'date-time' },
        },
      },
      CityBBox: {
        type: 'object',
        properties: {
          south: { type: 'number' },
          west: { type: 'number' },
          north: { type: 'number' },
          east: { type: 'number' },
          display_name: { type: 'string' },
        },
      },
      MarketplaceNormalized: {
        type: 'object',
        properties: {
          nom: { type: 'string' },
          ville: { type: 'string' },
          delimitation: {
            type: 'object',
            properties: {
              type: { type: 'string', example: 'Polygon' },
              coordinates: { type: 'array' },
            },
          },
        },
      },
    },
  },
};

export default swaggerSpec;
