# 📍 Guide : Contextes de Simulation (Météo, Économique, Démographique)

## 🎯 Vue d'ensemble

Le système de simulation permet de récupérer **automatiquement** les contextes météorologiques, économiques et démographiques d'une ville pour enrichir l'analyse AI. Ce guide explique comment bien utiliser ces fonctionnalités.

---

## 🔄 Récupération Automatique de Contexte

### ✅ Méthode Recommandée : Fournir uniquement `city`

```json
{
  "revenueId": "edecca6e-d16a-4ccf-8d02-02379c7231f5",
  "newAmount": 5000,
  "devise": "MGA",
  "city": "Mahajanga",
  "frequency": "monthly",
  "durationMonths": 12,
  "startDate": "2026-01-01",
  "note": "Simulation avec contextes automatiques"
}
```

**Résultat** : Le système récupère automatiquement :
- 🌤️ Météo actuelle (température, humidité, conditions)
- 💰 Indicateurs économiques (PIB, population, croissance)
- 👥 Données démographiques (capitale, région, langues, GINI)

---

## ⚠️ Erreur Courante : Objets Vides

### ❌ À NE PAS FAIRE

```json
{
  "revenueId": "...",
  "city": "Mahajanga",
  "weatherContext": {},      // ❌ BLOQUE la récupération auto
  "economicContext": {},     // ❌ BLOQUE la récupération auto
  "demographicContext": {}   // ❌ BLOQUE la récupération auto
}
```

**Problème** : Un objet vide `{}` est considéré comme "fourni" en JavaScript, donc le système ne récupère **PAS** les contextes automatiquement.

**Symptômes** :
```json
{
  "weather": null,
  "economic": { "population_2024": null, "gdp_2024_usd": null },
  "demographics": { "country": null, "capital": null, ... }
}
```

---

## ✅ Solutions

### Option 1 : Ne pas inclure les clés de contexte

```json
{
  "revenueId": "...",
  "city": "Mahajanga",
  "frequency": "monthly",
  "durationMonths": 12,
  "startDate": "2026-01-01"
  // ✅ Pas de weatherContext, economicContext, demographicContext
}
```

### Option 2 : Envoyer explicitement `null`

```json
{
  "revenueId": "...",
  "city": "Mahajanga",
  "weatherContext": null,      // ✅ OK - récupération auto
  "economicContext": null,     // ✅ OK - récupération auto
  "demographicContext": null   // ✅ OK - récupération auto
}
```

---

## 🎛️ Modes d'Utilisation

### Mode 1 : Récupération Automatique (Recommandé)

**Quand l'utiliser** : Pour toutes les simulations normales

```bash
curl -X POST http://localhost:3000/serviceprediction/simulations \
  -H "Content-Type: application/json" \
  -d '{
    "revenueId": "...",
    "city": "Mahajanga",
    "newAmount": 5000,
    "frequency": "monthly",
    "durationMonths": 12,
    "startDate": "2026-01-01"
  }'
```

**Avantages** :
- ✅ Enrichissement automatique de l'analyse AI
- ✅ Données en temps réel
- ✅ Aucune configuration manuelle

---

### Mode 2 : Contexte Manuel (Avancé)

**Quand l'utiliser** : Pour tester des scénarios spécifiques ou des données historiques

```json
{
  "revenueId": "...",
  "city": "Mahajanga",
  "weatherContext": {
    "temp": 28.5,
    "humidity": 75,
    "description": "Partiellement nuageux"
  },
  "economicContext": {
    "population_2024": 250000,
    "gdp_2024_usd": 500000000
  },
  "demographicContext": {
    "country": "Madagascar",
    "capital": "Antananarivo",
    "population": 30000000
  }
}
```

**Avantages** :
- ✅ Contrôle total sur les données
- ✅ Tests de scénarios "what-if"
- ✅ Utilisation de données historiques

---

### Mode 3 : Sans Contexte (Minimal)

**Quand l'utiliser** : Tests rapides sans enrichissement

```json
{
  "revenueId": "...",
  "newAmount": 5000,
  "frequency": "monthly",
  "durationMonths": 12,
  "startDate": "2026-01-01"
}
```

**Note** : L'analyse AI sera moins précise car elle manque de contexte local.

---

## 🔍 Vérification des Contextes Récupérés

### Logs Backend

Lors de la création d'une simulation, le backend affiche :

```
[Simulation Controller] Fetching contexts for city: Mahajanga
[Simulation Controller] City info: { lat: -15.7167, lon: 46.3167, country: 'mg' }
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
```

### Réponse HTTP

Vérifiez que les contextes ne sont **PAS** `null` :

```json
{
  "weather": {
    "temp": 28.5,
    "humidity": 75,
    "description": "Partiellement nuageux"
  },
  "economic": {
    "population_2024": 28000000,
    "gdp_2024_usd": 15000000000
  },
  "demographics": {
    "country": "Madagascar",
    "capital": "Antananarivo",
    "region": "Africa",
    "population": 30000000,
    "languages": ["French", "Malagasy"]
  }
}
```

---

## 🧪 Script de Test

Utilisez le script de test fourni pour valider les différents scénarios :

```bash
node test-simulation-with-context.js
```

Ce script teste :
1. ✅ Simulation AVEC `city` → Contextes récupérés automatiquement
2. ✅ Simulation SANS `city` → Contextes `null` (attendu)
3. ✅ Simulation avec objets vides `{}` → Doivent être ignorés et contextes récupérés

---

## 🌍 Villes Supportées

Le système utilise **Nominatim (OpenStreetMap)** pour la géolocalisation. Toutes les villes majeures du monde sont supportées.

### Exemples pour Madagascar

- `"Antananarivo"`
- `"Mahajanga"`
- `"Toamasina"`
- `"Antsirabe"`
- `"Fianarantsoa"`
- `"Toliara"`

### Format Accepté

```
"city": "Mahajanga"                    ✅ Nom simple
"city": "Mahajanga, Madagascar"        ✅ Nom + pays
"city": "Toamasina, Atsinanana, MG"   ✅ Nom + région + code pays
```

---

## 🐛 Dépannage

### Problème 1 : Contextes toujours `null`

**Symptôme** :
```json
{
  "weather": null,
  "economic": { "population_2024": null },
  "demographics": { "country": null }
}
```

**Solutions** :
1. ✅ Vérifiez que `city` est bien fourni dans la requête
2. ✅ Ne pas envoyer `weatherContext: {}`, `economicContext: {}`, etc.
3. ✅ Vérifiez les logs backend pour voir les erreurs de récupération
4. ✅ Testez avec le endpoint debug : `GET /serviceprediction/_debug/context?city=Mahajanga`

---

### Problème 2 : Erreur "City not found"

**Cause** : Nominatim ne trouve pas la ville

**Solutions** :
- ✅ Vérifiez l'orthographe : `"Mahajanga"` pas `"Majunga"`
- ✅ Ajoutez le pays : `"Mahajanga, Madagascar"`
- ✅ Utilisez le nom international : `"Antananarivo"` pas `"Tana"`

---

### Problème 3 : Données économiques manquantes

**Cause** : World Bank API peut échouer pour certains pays

**Solution** :
- Les données démographiques sont toujours disponibles via RestCountries API
- Les données météo sont toujours disponibles via OpenWeatherMap
- Les indicateurs économiques peuvent être partiellement `null` si World Bank n'a pas les données

---

## 📊 Impact sur l'Analyse AI

Les contextes enrichissent considérablement l'analyse AI :

### Sans Contexte
```json
{
  "prediction_summary": "Revenue will increase by 0.59%",
  "risks": [
    { "factor": "Generic economic risk", "probability": 0.5 }
  ]
}
```

### Avec Contexte
```json
{
  "prediction_summary": "Les revenus de paiement de parking à Mahajanga devraient augmenter de 0.59% en 2026, influencés par la croissance démographique locale et les conditions météorologiques saisonnières.",
  "risks": [
    {
      "factor": "Conditions météorologiques défavorables",
      "description": "Des cyclones ou fortes pluies pendant la saison des pluies à Mahajanga pourraient réduire la fréquentation des parkings",
      "probability": 0.4
    }
  ]
}
```

---

## 🔐 Configuration Requise

### Variables d'Environnement

```env
# OpenWeatherMap (météo)
OPENWEATHER_API_KEY=your_api_key_here

# Nominatim (géolocalisation) - Pas de clé requise
# World Bank API - Pas de clé requise
# RestCountries API - Pas de clé requise
```

**Note** : Seule `OPENWEATHER_API_KEY` est requise. Les autres APIs sont publiques.

---

## 📚 Ressources

- [OpenWeatherMap API](https://openweathermap.org/api)
- [Nominatim (OpenStreetMap)](https://nominatim.org/)
- [World Bank API](https://datahelpdesk.worldbank.org/knowledgebase/articles/889392)
- [RestCountries API](https://restcountries.com/)

---

## ✅ Checklist de Bonne Utilisation

- [ ] Fournir `"city"` dans la requête POST
- [ ] **NE PAS** envoyer `weatherContext: {}`
- [ ] **NE PAS** envoyer `economicContext: {}`
- [ ] **NE PAS** envoyer `demographicContext: {}`
- [ ] Vérifier les logs backend pour confirmer la récupération
- [ ] Vérifier que les contextes ne sont pas `null` dans la réponse
- [ ] Confirmer que l'analyse AI est en français et utilise les contextes

---

**Version** : 1.0.0  
**Dernière mise à jour** : 27 novembre 2025  
**Auteur** : Backend Simulation Team
