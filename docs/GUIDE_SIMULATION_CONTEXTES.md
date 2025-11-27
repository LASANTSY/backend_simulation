# 📍 Guide Complet - Récupération Automatique des Contextes pour Simulations

## 🎯 Problème Résolu

**Symptômes observés:**
- ✅ Les contextes (météo, économie, démographie) sont `null` dans les réponses
- ✅ L'analyse AI revient en **anglais** au lieu du français
- ✅ Les prédictions manquent de pertinence contextuelle

**Cause:** Paramètre `city` manquant dans la requête POST

---

## ✅ Solution: Inclure le Paramètre `city`

### Requête Correcte (AVEC city)

```bash
POST /serviceprediction/simulations
Content-Type: application/json

{
  "revenueId": "edecca6e-d16a-4ccf-8d02-02379c7231f5",
  "newAmount": 5000,
  "frequency": "monthly",
  "durationMonths": 12,
  "startDate": "2026-01-01",
  "devise": "MGA",
  "city": "Antananarivo"  ⬅️ 🔥 PARAMÈTRE CRUCIAL
}
```

### Requête Incomplète (SANS city - contextes null)

```bash
POST /serviceprediction/simulations
Content-Type: application/json

{
  "revenueId": "edecca6e-d16a-4ccf-8d02-02379c7231f5",
  "newAmount": 5000,
  "frequency": "monthly",
  "durationMonths": 12,
  "startDate": "2026-01-01",
  "devise": "MGA"
  // ❌ Pas de "city" → Contextes non récupérés
}
```

---

## 🌍 Villes Supportées (Madagascar)

Le système utilise **Nominatim OpenStreetMap** pour géolocaliser la ville, puis récupère:
- 🌤️ **Météo actuelle** (via Open-Meteo)
- 💰 **Indicateurs économiques** (PIB, population via World Bank/IMF/RestCountries)
- 👥 **Données démographiques** (via RestCountries API)
- 🍂 **Contexte saisonnier** (calculé automatiquement selon la date de début)

### Exemples de villes valides:

```json
"city": "Antananarivo"     // ✅ Capitale
"city": "Toamasina"        // ✅ Port principal
"city": "Antsirabe"        // ✅ Ville thermale
"city": "Mahajanga"        // ✅ Côte ouest
"city": "Fianarantsoa"     // ✅ Hautes terres
"city": "Toliara"          // ✅ Sud-ouest
"city": "Antsiranana"      // ✅ Nord (Diego-Suarez)
```

**Format accepté:** Nom de la ville en français (avec accents si applicable)

---

## 📊 Impact du Paramètre `city` sur la Réponse

### Sans `city` (contextes null) ❌

```json
{
  "weather": null,
  "economic": {
    "population_2024": null,
    "gdp_2024_usd": null
  },
  "demographics": {
    "country": null,
    "capital": null,
    "region": null,
    "population": null
  },
  "analysis_results": {
    "ai_analysis": {
      "prediction_summary": "The projected revenue...",  // ❌ En anglais
      "interpretation": "The projected increase...",      // ❌ Contexte manquant
      "risks": [
        {
          "factor": "Economic Downturn",                  // ❌ Anglais
          "description": "A potential economic slowdown..." 
        }
      ]
    }
  }
}
```

### Avec `city: "Antananarivo"` (contextes récupérés) ✅

```json
{
  "weather": {
    "temperature_celsius": 22.5,
    "humidity_percent": 65,
    "precipitation_mm": 0.2,
    "wind_speed_kmh": 12,
    "conditions": "Partly cloudy",
    "source": "Open-Meteo API",
    "fetched_at": "2025-11-27T15:30:00Z"
  },
  "economic": {
    "population_2024": 30325732,
    "gdp_2024_usd": 15960000000,
    "gdp_per_capita_usd": 526,
    "source": "World Bank/IMF"
  },
  "demographics": {
    "country": "Madagascar",
    "capital": "Antananarivo",
    "region": "Africa",
    "subregion": "Eastern Africa",
    "population": 30325732,
    "languages": ["Malagasy", "French"],
    "gini": 42.6
  },
  "analysis_results": {
    "ai_analysis": {
      "prediction_summary": "La projection des revenus de stationnement montre une augmentation modérée de 0,59% sur 12 mois...",  // ✅ Français
      "interpretation": "L'augmentation projetée de 0,59% reflète un équilibre entre les fluctuations saisonnières et la stabilité économique d'Antananarivo. Les conditions météorologiques favorables (22°C, faible précipitation) soutiennent l'activité urbaine...",  // ✅ Contexte intégré
      "risks": [
        {
          "factor": "Ralentissement économique à Antananarivo",  // ✅ Français
          "description": "Un ralentissement économique dans la capitale pourrait réduire l'activité et la demande de stationnement, avec un impact moyen sur les revenus.",
          "impact": "medium",
          "probability": 0.4
        },
        {
          "factor": "Événements météorologiques extrêmes",
          "description": "Des pluies intenses durant la saison des pluies (novembre-mars) à Madagascar pourraient dissuader les déplacements et impacter les revenus de stationnement.",
          "impact": "medium",
          "probability": 0.3
        }
      ],
      "opportunities": [
        {
          "description": "Promotions ciblées durant les événements locaux et festivals à Antananarivo pour augmenter les revenus de stationnement.",
          "impact": 0.6
        }
      ],
      "recommendations": [
        {
          "priority": 1,
          "action": "Surveiller étroitement les indicateurs économiques d'Antananarivo (PIB, taux de chômage, inflation) pour anticiper les baisses de revenus.",
          "justification": "La détection précoce des risques économiques permet d'adapter la stratégie tarifaire et d'optimiser les revenus de stationnement."
        }
      ]
    }
  }
}
```

---

## 🔧 Exemples de Requêtes cURL

### Exemple 1: Simulation Mensuelle à Antananarivo

```bash
curl -X POST http://localhost:3000/serviceprediction/simulations \
  -H "Content-Type: application/json" \
  -d '{
    "revenueId": "edecca6e-d16a-4ccf-8d02-02379c7231f5",
    "newAmount": 5000,
    "frequency": "monthly",
    "durationMonths": 12,
    "startDate": "2026-01-01",
    "devise": "MGA",
    "city": "Antananarivo"
  }'
```

### Exemple 2: Simulation Annuelle à Toamasina

```bash
curl -X POST http://localhost:3000/serviceprediction/simulations \
  -H "Content-Type: application/json" \
  -d '{
    "revenueId": "abc123-456-789",
    "newAmount": 50000,
    "frequency": "annual",
    "durationMonths": 24,
    "startDate": "2026-06-01",
    "devise": "MGA",
    "city": "Toamasina",
    "note": "Projection pour le port de Toamasina"
  }'
```

### Exemple 3: Contextes Fournis Manuellement (optionnel)

Si vous disposez déjà des contextes, vous pouvez les fournir directement (le paramètre `city` devient optionnel):

```bash
curl -X POST http://localhost:3000/serviceprediction/simulations \
  -H "Content-Type: application/json" \
  -d '{
    "revenueId": "edecca6e-d16a-4ccf-8d02-02379c7231f5",
    "newAmount": 5000,
    "frequency": "monthly",
    "durationMonths": 12,
    "startDate": "2026-01-01",
    "devise": "MGA",
    "weatherContext": {
      "temperature_celsius": 25,
      "humidity_percent": 70
    },
    "economicContext": {
      "population_2024": 30000000,
      "gdp_2024_usd": 16000000000
    },
    "demographicContext": {
      "country": "Madagascar",
      "population": 30000000
    },
    "seasonContext": {
      "season": "summer"
    }
  }'
```

---

## 🎨 Schéma de Fonctionnement

```
┌─────────────────────────────────────────────────────────────┐
│  POST /serviceprediction/simulations                        │
│  { "city": "Antananarivo", ... }                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
         ┌─────────────────────────────┐
         │ simulation.controller.ts    │
         │ Vérifie si city fourni      │
         └──────────┬──────────────────┘
                    │
        ┌───────────▼────────────┐
        │ Si city présent        │
        │ ET contextes manquants │
        └───────────┬────────────┘
                    │
                    ▼
        ┌───────────────────────────────────────────┐
        │ 1. PlaceService.getCityInfo(city)         │
        │    → Nominatim: lat, lon, country         │
        ├───────────────────────────────────────────┤
        │ 2. contextService.fetchContextForSimulation│
        │    - Open-Meteo: météo actuelle           │
        │    - World Bank/IMF: PIB, population      │
        │    - RestCountries: données démographiques│
        │    - Calcul saison (selon startDate)      │
        └───────────┬───────────────────────────────┘
                    │
                    ▼
        ┌───────────────────────────────────────────┐
        │ simulationService.createAndRunSimulation  │
        │ - Stocke contextes en DB                  │
        │ - Calcul baseline vs simulated            │
        │ - Applique méthodes prédictives:          │
        │   • Régression linéaire                   │
        │   • Réseau de neurones TensorFlow         │
        │   • Ajustement saisonnier                 │
        └───────────┬───────────────────────────────┘
                    │
                    ▼
        ┌───────────────────────────────────────────┐
        │ aiService.enrichAnalysis(...)             │
        │ - Construit prompt EN FRANÇAIS            │
        │ - Appelle Gemini avec contextes complets  │
        │ - Parse réponse JSON structurée           │
        │ - Sauvegarde aiAnalysis en DB             │
        └───────────┬───────────────────────────────┘
                    │
                    ▼
        ┌───────────────────────────────────────────┐
        │ Réponse JSON complète avec:               │
        │ - Contextes récupérés (non null)         │
        │ - Analyse AI EN FRANÇAIS                  │
        │ - Risques, opportunités, recommandations  │
        │   contextualisés selon la ville           │
        └───────────────────────────────────────────┘
```

---

## 🔍 Débogage des Contextes

### Endpoint de Debug (en développement)

```bash
GET /serviceprediction/_debug/context?city=Antananarivo
```

**Réponse:**
```json
{
  "cityInfo": {
    "lat": -18.8792,
    "lon": 47.5079,
    "display_name": "Antananarivo, Madagascar",
    "address": {
      "country": "Madagascar",
      "country_code": "mg"
    }
  },
  "weather": { ... },
  "economic": { ... },
  "demographics": { ... },
  "season": "summer"
}
```

### Logs dans la Console Backend

Lorsque vous lancez une simulation avec `city`, recherchez ces logs:

```
[Simulation Controller] Fetching contexts for city: Antananarivo
[Simulation Controller] City info: { lat: -18.8792, lon: 47.5079, country: 'mg' }
[Simulation Controller] Country for indicators: MG
[Simulation Controller] Fetched contexts: {
  hasWeather: true,
  hasEconomic: true,
  hasDemographics: true,
  hasSeason: true
}
[Simulation Controller] Final contexts to pass: {
  hasWeather: true,
  hasEconomic: true,
  hasDemographics: true,
  hasSeason: true
}
[AI enrichAnalysis] Contexts provided: {
  hasTime: true,
  hasWeather: true,
  hasEconomy: true,
  hasDemography: true,
  hasSeason: true,
  season: 'summer'
}
```

**Si vous voyez `hasWeather: false` ou `hasEconomic: false`:**
- ✅ Vérifiez que la ville est reconnue par Nominatim
- ✅ Vérifiez la connectivité internet du serveur
- ✅ Consultez les logs détaillés pour identifier l'API défaillante

---

## ⚠️ Garantir la Langue Française

### Modifications Appliquées au Prompt Gemini

Le système prompt a été renforcé pour **forcer ABSOLUMENT** la langue française:

```typescript
// Extrait de ai.service.ts (GEMINI_SYSTEM_PROMPT)
`⚠️ RÈGLES ABSOLUES ET NON-NÉGOCIABLES:
1. Répondez UNIQUEMENT en langue FRANÇAISE (jamais en anglais ou autre langue)
2. Produisez UNIQUEMENT un objet JSON valide, sans Markdown, sans backticks
3. TOUS les champs textuels (summary, interpretation, description, factor, 
   action, justification, etc.) DOIVENT être rédigés EN FRANÇAIS

⚠️⚠️⚠️ RAPPEL FINAL IMPÉRATIF ⚠️⚠️⚠️
RÉPONDEZ INTÉGRALEMENT EN LANGUE FRANÇAISE.
AUCUN MOT EN ANGLAIS N'EST ACCEPTÉ dans les champs textuels.
Si vous répondez en anglais, votre réponse sera REJETÉE.`
```

### Structure JSON Annotée

Chaque champ de la structure JSON attendue est maintenant annoté avec "EN FRANÇAIS":

```json
{
  "prediction": {
    "summary": "string EN FRANÇAIS (synthèse claire...)",
    ...
  },
  "interpretation": "string EN FRANÇAIS (4-7 phrases...)",
  "risks": [
    {
      "factor": "string EN FRANÇAIS (nom du risque)",
      "description": "string EN FRANÇAIS (explication...)"
    }
  ],
  ...
}
```

---

## 📋 Checklist de Validation

Avant de lancer une simulation, vérifiez:

- [ ] ✅ Le champ `"city"` est **présent** dans le JSON de requête
- [ ] ✅ Le nom de la ville est **valide** (ex: "Antananarivo", "Toamasina")
- [ ] ✅ Le serveur backend est **démarré** (`npm run start:dev`)
- [ ] ✅ Les services externes sont **accessibles** (Open-Meteo, World Bank, RestCountries)
- [ ] ✅ La clé API Gemini (`GEMINI_API_KEY`) est **configurée** dans `.env`

**Résultat attendu:**
- ✅ Contextes non-null dans la réponse
- ✅ Analyse AI entièrement **EN FRANÇAIS**
- ✅ Risques, opportunités et recommandations **contextualisés** selon la ville

---

## 🚀 Exemples de Tests Rapides

### Test 1: Vérifier la Récupération de Contextes

```bash
# Lancer une simulation basique avec city
curl -X POST http://localhost:3000/serviceprediction/simulations \
  -H "Content-Type: application/json" \
  -d '{
    "revenueId": "edecca6e-d16a-4ccf-8d02-02379c7231f5",
    "newAmount": 3500,
    "frequency": "monthly",
    "durationMonths": 6,
    "startDate": "2026-01-01",
    "city": "Antananarivo"
  }' | jq '.weather, .economic.population_2024, .demographics.country'
```

**Sortie attendue:**
```json
{
  "temperature_celsius": 22.5,
  "humidity_percent": 65,
  ...
}
30325732
"Madagascar"
```

### Test 2: Vérifier la Langue de l'Analyse AI

```bash
curl -X POST http://localhost:3000/serviceprediction/simulations \
  -H "Content-Type: application/json" \
  -d '{
    "revenueId": "edecca6e-d16a-4ccf-8d02-02379c7231f5",
    "newAmount": 4000,
    "frequency": "monthly",
    "durationMonths": 12,
    "startDate": "2026-01-01",
    "city": "Fianarantsoa"
  }' | jq '.analysis_results.ai_analysis.interpretation'
```

**Sortie attendue (extrait en français):**
```
"La projection de 0,75% d'augmentation des revenus à Fianarantsoa reflète une dynamique positive soutenue par la croissance démographique et les conditions climatiques favorables des hautes terres..."
```

---

## 📚 Ressources Complémentaires

- [Documentation Complète Simulations](./PREDICTIONS_OVERVIEW.md)
- [Guide Quickstart](./QUICKSTART_PREDICTIONS.md)
- [Méthodes Prédictives](./PREDICTION_METHODS_GUIDE.md)
- [Commandes Essentielles](./COMMANDS_CHEATSHEET.md)
- [Intégration Nominatim](./NOMINATIM_INTEGRATION_GUIDE.md)

---

**Auteur:** Système de Simulation de Revenus Fiscaux  
**Version:** 2.0.0  
**Date:** 27 novembre 2025  
**Langue:** Français 🇫🇷
