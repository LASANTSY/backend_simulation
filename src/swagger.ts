const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'API Service Prédiction - Mobilisation Recette Locale',
    version: '1.0.0',
    description: 'API pour la gestion des recettes, prédictions, simulations et validation de conformité réglementaire pour les collectivités territoriales décentralisées de Madagascar.',
  },
  servers: [
    { 
      url: 'http://localhost:3000', 
      description: 'Serveur local de développement' 
    }
  ],
  tags: [
    { name: 'Revenus', description: 'Gestion des recettes (CRUD)' },
    { name: 'Prédictions', description: 'Calculs et stockage des prévisions' },
    { name: 'Simulations', description: "Scénarios et analyses d'impact" },
    { name: 'Marchés', description: 'Intégrations externes (OpenStreetMap, Nominatim)' },
    { name: 'Optimisation', description: 'Enrichissement IA et optimisation du timing' },
    { name: 'Légalité', description: 'Validation et normalisation des recettes (PCOP/LFI 2025)' },
  ],
  paths: {
    // ========================================
    // REVENUS
    // ========================================
    '/serviceprediction/revenues': {
      get: {
        tags: ['Revenus'],
        summary: 'Lister les recettes',
        description: 'Récupère la liste des recettes, optionnellement filtrée par municipalité',
        parameters: [
          {
            name: 'municipalityId',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description: 'Filtrer par identifiant de municipalité'
          }
        ],
        responses: {
          '200': {
            description: 'Liste des recettes',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Revenue' }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Revenus'],
        summary: 'Créer une nouvelle recette',
        description: 'Enregistre une nouvelle recette et synchronise optionnellement avec les sources externes',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateRevenueDto' }
            }
          }
        },
        responses: {
          '201': {
            description: 'Recette créée avec succès',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Revenue' }
              }
            }
          },
          '400': { description: 'Données invalides' }
        }
      }
    },
    '/serviceprediction/revenues/{id}': {
      get: {
        tags: ['Revenus'],
        summary: 'Récupérer une recette',
        description: 'Obtient les détails d\'une recette spécifique',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
            description: 'Identifiant unique de la recette'
          }
        ],
        responses: {
          '200': {
            description: 'Détails de la recette',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Revenue' }
              }
            }
          },
          '404': { description: 'Recette non trouvée' }
        }
      },
      put: {
        tags: ['Revenus'],
        summary: 'Mettre à jour une recette',
        description: 'Modifie les données d\'une recette existante',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateRevenueDto' }
            }
          }
        },
        responses: {
          '200': {
            description: 'Recette mise à jour',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Revenue' }
              }
            }
          },
          '404': { description: 'Recette non trouvée' }
        }
      },
      delete: {
        tags: ['Revenus'],
        summary: 'Supprimer une recette',
        description: 'Supprime définitivement une recette',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' }
          }
        ],
        responses: {
          '204': { description: 'Recette supprimée avec succès' },
          '404': { description: 'Recette non trouvée' }
        }
      }
    },

    // ========================================
    // PRÉDICTIONS
    // ========================================
    '/serviceprediction/predictions/run': {
      post: {
        tags: ['Prédictions'],
        summary: 'Lancer une prédiction',
        description: 'Exécute une prédiction de revenus avec méthodes quantitatives (régression linéaire, facteurs saisonniers, neural network)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PredictionRunDto' }
            }
          }
        },
        responses: {
          '201': {
            description: 'Prédiction créée et exécutée',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Prediction' }
              }
            }
          },
          '400': { description: 'Paramètres invalides' }
        }
      }
    },
    '/serviceprediction/predictions': {
      get: {
        tags: ['Prédictions'],
        summary: 'Lister les prédictions',
        description: 'Récupère l\'historique des prédictions enregistrées',
        parameters: [
          {
            name: 'municipalityId',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description: 'Filtrer par municipalité'
          }
        ],
        responses: {
          '200': {
            description: 'Liste des prédictions',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Prediction' }
                }
              }
            }
          }
        }
      }
    },

    // ========================================
    // SIMULATIONS
    // ========================================
    '/serviceprediction/simulations': {
      post: {
        tags: ['Simulations'],
        summary: 'Créer une simulation',
        description: 'Crée un scénario de simulation avec contextes automatiques (météo, économie, démographie)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateSimulationDto' }
            }
          }
        },
        responses: {
          '201': {
            description: 'Simulation créée',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Simulation' }
              }
            }
          },
          '400': { description: 'Données invalides' }
        }
      },
      get: {
        tags: ['Simulations'],
        summary: 'Lister les simulations',
        description: 'Récupère toutes les simulations enregistrées',
        parameters: [
          {
            name: 'municipalityId',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description: 'Filtrer par municipalité'
          }
        ],
        responses: {
          '200': {
            description: 'Liste des simulations',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Simulation' }
                }
              }
            }
          }
        }
      }
    },
    '/serviceprediction/simulations/{id}': {
      get: {
        tags: ['Simulations'],
        summary: 'Récupérer une simulation',
        description: 'Obtient les détails d\'une simulation spécifique',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' }
          }
        ],
        responses: {
          '200': {
            description: 'Détails de la simulation',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Simulation' }
              }
            }
          },
          '404': { description: 'Simulation non trouvée' }
        }
      }
    },

    // ========================================
    // MARCHÉS
    // ========================================
    '/serviceprediction/markets': {
      get: {
        tags: ['Marchés'],
        summary: 'Récupérer les marchés via OpenStreetMap',
        description: 'Interroge l\'API Overpass pour obtenir les marketplaces dans une zone géographique',
        parameters: [
          {
            name: 'city',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description: 'Nom de la ville'
          },
          {
            name: 'south',
            in: 'query',
            required: true,
            schema: { type: 'number' },
            description: 'Latitude sud (min)'
          },
          {
            name: 'west',
            in: 'query',
            required: true,
            schema: { type: 'number' },
            description: 'Longitude ouest (min)'
          },
          {
            name: 'north',
            in: 'query',
            required: true,
            schema: { type: 'number' },
            description: 'Latitude nord (max)'
          },
          {
            name: 'east',
            in: 'query',
            required: true,
            schema: { type: 'number' },
            description: 'Longitude est (max)'
          }
        ],
        responses: {
          '200': {
            description: 'Liste des marchés',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Marketplace' }
                }
              }
            }
          },
          '400': { description: 'Paramètres invalides' },
          '502': { description: 'Erreur API externe' }
        }
      }
    },
    '/serviceprediction/markets/stored': {
      get: {
        tags: ['Marchés'],
        summary: 'Récupérer les marchés stockés localement',
        description: 'Liste les marketplaces enregistrées dans la base de données',
        parameters: [
          {
            name: 'city',
            in: 'query',
            required: false,
            schema: { type: 'string' }
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            schema: { type: 'integer' }
          }
        ],
        responses: {
          '200': {
            description: 'Marchés stockés',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Marketplace' }
                }
              }
            }
          }
        }
      }
    },
    '/serviceprediction/places/bbox': {
      get: {
        tags: ['Marchés'],
        summary: 'Obtenir le bounding box d\'une ville',
        description: 'Utilise l\'API Nominatim pour récupérer les coordonnées géographiques d\'une ville',
        parameters: [
          {
            name: 'city',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            description: 'Nom de la ville (ex: Antananarivo)'
          }
        ],
        responses: {
          '200': {
            description: 'Bounding box de la ville',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CityBBox' }
              }
            }
          },
          '404': { description: 'Ville non trouvée' }
        }
      }
    },
    '/serviceprediction/markets/by-city': {
      get: {
        tags: ['Marchés'],
        summary: 'Récupérer les marchés par ville',
        description: 'Combine bbox + markets pour obtenir automatiquement les marchés d\'une ville',
        parameters: [
          {
            name: 'ville',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            description: 'Nom de la ville'
          }
        ],
        responses: {
          '200': {
            description: 'Marchés de la ville',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/MarketplaceNormalized' }
                }
              }
            }
          },
          '404': { description: 'Ville non trouvée' }
        }
      }
    },
    '/serviceprediction/markets/normalized': {
      get: {
        tags: ['Marchés'],
        summary: 'Lister les marchés normalisés',
        description: 'Retourne les marchés avec nom, ville et délimitation GeoJSON',
        parameters: [
          {
            name: 'city',
            in: 'query',
            required: false,
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Marchés normalisés',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/MarketplaceNormalized' }
                }
              }
            }
          }
        }
      }
    },

    // ========================================
    // OPTIMISATION
    // ========================================
    '/serviceprediction/analysis-results/{id}/enrich': {
      post: {
        tags: ['Optimisation'],
        summary: 'Enrichir une analyse avec l\'IA',
        description: 'Utilise Gemini AI pour générer une interprétation détaillée des résultats de simulation',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' }
          }
        ],
        responses: {
          '200': {
            description: 'Analyse enrichie',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AnalysisResult' }
              }
            }
          },
          '404': { description: 'Résultat non trouvé' },
          '500': { description: 'Erreur IA' }
        }
      }
    },
    '/serviceprediction/simulations/{id}/optimize': {
      post: {
        tags: ['Optimisation'],
        summary: 'Optimiser le timing d\'une simulation',
        description: 'Analyse et recommande le meilleur moment pour implémenter les changements',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' }
          }
        ],
        responses: {
          '200': {
            description: 'Recommandations d\'optimisation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    bestMonth: { type: 'string' },
                    reasoning: { type: 'string' },
                    score: { type: 'number' }
                  }
                }
              }
            }
          },
          '404': { description: 'Simulation non trouvée' }
        }
      }
    },

    // ========================================
    // LÉGALITÉ (Validation de Recettes)
    // ========================================
    '/serviceprediction/revenue-validation': {
      post: {
        tags: ['Légalité'],
        summary: 'Valider et normaliser une recette locale',
        description: 'Analyse une recette proposée par rapport au PCOP 2006 CTD et au Code des Impôts (LFI 2025). Retourne le nom normalisé et une description structurée incluant la base légale, la nomenclature comptable, l\'assiette, les taux et les modalités de recouvrement.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ValidateRevenueRequestDto' },
              examples: {
                ifpb: {
                  summary: 'Abréviation IFPB',
                  value: {
                    name: 'IFPB',
                    municipality_id: 'antananarivo-001'
                  }
                },
                taxe_marche: {
                  summary: 'Taxe marché municipal',
                  value: {
                    name: 'Taxe marché municipal',
                    municipality_id: 'fianarantsoa-001'
                  }
                },
                loyer: {
                  summary: 'Recette domaniale',
                  value: {
                    name: 'Loyer boutique',
                    municipality_id: 'mahajanga-001'
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Validation effectuée avec succès',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidateRevenueResponseDto' },
                examples: {
                  valid: {
                    summary: 'Recette valide',
                    value: {
                      name: 'Impôt Foncier sur la Propriété Bâtie (IFPB)',
                      status: 'valid',
                      description: '- Base légale : Code Général des Impôts...\n- Nomenclature PCOP : Classe 6...',
                      municipality_id: 'antananarivo-001'
                    }
                  },
                  invalid: {
                    summary: 'Recette non conforme',
                    value: {
                      name: null,
                      status: 'invalid',
                      description: 'ERREUR : La recette fournie ne correspond à aucune recette...',
                      municipality_id: 'antananarivo-001'
                    }
                  }
                }
              }
            }
          },
          '400': { description: 'Données d\'entrée invalides' },
          '500': { description: 'Erreur interne du serveur' }
        }
      }
    },
    '/serviceprediction/revenue-validation/history': {
      get: {
        tags: ['Légalité'],
        summary: 'Récupérer l\'historique des validations',
        description: 'Retourne l\'historique des validations de recettes, optionnellement filtré par municipalité',
        parameters: [
          {
            name: 'municipalityId',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description: 'Identifiant de la municipalité pour filtrer les résultats'
          }
        ],
        responses: {
          '200': {
            description: 'Historique récupéré avec succès',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/RevenueValidation' }
                }
              }
            }
          }
        }
      }
    },
    '/serviceprediction/revenue-validation/{id}': {
      get: {
        tags: ['Légalité'],
        summary: 'Récupérer une validation spécifique',
        description: 'Retourne les détails d\'une validation de recette par son identifiant',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
            description: 'Identifiant unique de la validation'
          }
        ],
        responses: {
          '200': {
            description: 'Validation trouvée',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RevenueValidation' }
              }
            }
          },
          '404': { description: 'Validation non trouvée' }
        }
      }
    }
  },

  // ========================================
  // COMPONENTS / SCHEMAS
  // ========================================
  components: {
    schemas: {
      // Revenus
      Revenue: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          date: { type: 'string', format: 'date' },
          amount: { type: 'number', format: 'double' },
          source: { type: 'string' },
          name: { type: 'string' },
          parameters: { type: 'object' },
          municipalityId: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      CreateRevenueDto: {
        type: 'object',
        required: ['amount', 'date'],
        properties: {
          amount: { type: 'number', example: 1500.50 },
          date: { type: 'string', format: 'date', example: '2025-01-15' },
          source: { type: 'string', example: 'guichet' },
          name: { type: 'string', example: 'Taxe marché' },
          parameters: { type: 'object' },
          municipalityId: { type: 'string' }
        }
      },
      UpdateRevenueDto: {
        type: 'object',
        properties: {
          amount: { type: 'number' },
          date: { type: 'string', format: 'date' },
          source: { type: 'string' },
          name: { type: 'string' },
          parameters: { type: 'object' }
        }
      },

      // Prédictions
      Prediction: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          municipalityId: { type: 'string' },
          predictions: { type: 'object' },
          methods: {
            type: 'object',
            properties: {
              linearRegression: { type: 'object' },
              seasonalFactors: { type: 'object' },
              neuralNetwork: { type: 'object' }
            }
          },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      PredictionRunDto: {
        type: 'object',
        required: ['municipalityId'],
        properties: {
          municipalityId: { type: 'string' },
          months: { type: 'integer', default: 12 },
          years: { type: 'integer', default: 1 },
          period: { type: 'string', enum: ['monthly', 'annual', 'both'], default: 'both' }
        }
      },

      // Simulations
      Simulation: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          parameters: { type: 'object' },
          status: { type: 'string' },
          weatherContext: { type: 'object' },
          economicContext: { type: 'object' },
          demographicContext: { type: 'object' },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      CreateSimulationDto: {
        type: 'object',
        required: ['revenueId', 'newAmount', 'frequency', 'durationMonths', 'city'],
        properties: {
          revenueId: { type: 'string', format: 'uuid' },
          newAmount: { type: 'number' },
          devise: { type: 'string', default: 'MGA' },
          city: { type: 'string', example: 'Antananarivo' },
          frequency: { type: 'string', enum: ['monthly', 'annual'] },
          durationMonths: { type: 'integer' },
          startDate: { type: 'string', format: 'date' },
          note: { type: 'string' },
          weatherContext: { type: 'object' },
          economicContext: { type: 'object' },
          demographicContext: { type: 'object' }
        }
      },

      // Analyse
      AnalysisResult: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          simulationId: { type: 'string', format: 'uuid' },
          resultData: { type: 'object' },
          summary: { type: 'string' },
          interpretation: { type: 'string' },
          risks: { type: 'array', items: { type: 'object' } },
          opportunities: { type: 'array', items: { type: 'object' } },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },

      // Marchés
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
          fetched_at: { type: 'string', format: 'date-time' }
        }
      },
      CityBBox: {
        type: 'object',
        properties: {
          south: { type: 'number' },
          west: { type: 'number' },
          north: { type: 'number' },
          east: { type: 'number' },
          display_name: { type: 'string' }
        }
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
              coordinates: { type: 'array' }
            }
          }
        }
      },

      // Validation de Recettes
      ValidateRevenueRequestDto: {
        type: 'object',
        required: ['name', 'municipality_id'],
        properties: {
          name: {
            type: 'string',
            description: 'Nom de la recette proposée par l\'utilisateur',
            example: 'IFPB'
          },
          municipality_id: {
            type: 'string',
            description: 'Identifiant de la municipalité',
            example: 'municipality-uuid-123'
          }
        }
      },
      ValidateRevenueResponseDto: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            nullable: true,
            description: 'Nom officiel normalisé selon PCOP/LFI, ou null si non conforme',
            example: 'Impôt Foncier sur la Propriété Bâtie (IFPB)'
          },
          status: {
            type: 'string',
            enum: ['valid', 'invalid', 'ambiguous', 'pending'],
            description: 'Statut de la validation : valid (recette conforme normalisée), invalid (recette non conforme), ambiguous (plusieurs correspondances possibles), pending (en attente)',
            example: 'valid'
          },
          description: {
            type: 'string',
            description: 'Description structurée (base légale, nomenclature PCOP, nature, assiette, taux, modalités)',
            example: '- Base légale : Code des Impôts art. 123...'
          },
          municipality_id: {
            type: 'string',
            description: 'Identifiant de la municipalité (recopié)',
            example: 'municipality-uuid-123'
          }
        }
      },
      RevenueValidation: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          originalName: { type: 'string' },
          normalizedName: { type: 'string', nullable: true },
          description: { type: 'string', nullable: true },
          municipalityId: { type: 'string', nullable: true },
          status: {
            type: 'string',
            enum: ['valid', 'invalid', 'ambiguous', 'pending', 'error']
          },
          pcopReference: {
            type: 'object',
            nullable: true,
            properties: {
              classe: { type: 'string' },
              chapitre: { type: 'string' },
              compte: { type: 'string' }
            }
          },
          legalReference: {
            type: 'object',
            nullable: true,
            properties: {
              articles: { type: 'array', items: { type: 'string' } },
              loi: { type: 'string' }
            }
          },
          revenueType: { type: 'string', nullable: true },
          assiette: { type: 'string', nullable: true },
          taux: { type: 'string', nullable: true },
          modalitesRecouvrement: { type: 'string', nullable: true },
          conditionsApplication: { type: 'string', nullable: true },
          observations: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      }
    }
  }
};

export default swaggerSpec;
