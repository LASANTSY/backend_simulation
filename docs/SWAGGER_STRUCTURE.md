# 📚 Structure Swagger - API Service Prédiction

## Vue d'ensemble

Cette documentation décrit l'organisation complète de l'API Swagger restructurée pour le système de mobilisation des recettes locales de Madagascar.

**URL Swagger UI** : `http://localhost:3000/serviceprediction/docs`

---

## 🏷️ Tags (Catégories)

### 1. **Revenus**
Gestion CRUD complète des recettes locales

### 2. **Prédictions**
Calculs prédictifs avec méthodes quantitatives (ML, régression, saisonnalité)

### 3. **Simulations**
Scénarios d'impact et analyses contextuelles

### 4. **Marchés**
Intégrations OpenStreetMap et Nominatim pour la géolocalisation

### 5. **Optimisation**
Enrichissement IA via Gemini et optimisation du timing

### 6. **Légalité**
**NOUVEAU** - Validation et normalisation réglementaire (PCOP 2006 / LFI 2025)

---

## 📋 Endpoints par catégorie

### 🟢 Revenus

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/serviceprediction/revenues` | Lister toutes les recettes (filtrable par municipalité) |
| `POST` | `/serviceprediction/revenues` | Créer une nouvelle recette |
| `GET` | `/serviceprediction/revenues/{id}` | Récupérer une recette spécifique |
| `PUT` | `/serviceprediction/revenues/{id}` | Mettre à jour une recette |
| `DELETE` | `/serviceprediction/revenues/{id}` | Supprimer une recette |

**Exemples d'utilisation** :
```bash
# Lister les recettes
curl http://localhost:3000/serviceprediction/revenues

# Créer une recette
curl -X POST http://localhost:3000/serviceprediction/revenues \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1500.50,
    "date": "2025-01-15",
    "name": "Taxe marché",
    "source": "guichet"
  }'
```

---

### 🔮 Prédictions

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/serviceprediction/predictions/run` | Lancer une prédiction (régression linéaire, neural network, saisonnalité) |
| `GET` | `/serviceprediction/predictions` | Lister l'historique des prédictions |

**Méthodes quantitatives utilisées** :
- Régression linéaire
- Facteurs saisonniers
- Neural Network (TensorFlow.js via service Docker)

**Exemple** :
```bash
curl -X POST http://localhost:3000/serviceprediction/predictions/run \
  -H "Content-Type: application/json" \
  -d '{
    "municipalityId": "antananarivo-001",
    "months": 12,
    "period": "both"
  }'
```

---

### 🎭 Simulations

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/serviceprediction/simulations` | Créer un scénario de simulation |
| `GET` | `/serviceprediction/simulations` | Lister toutes les simulations |
| `GET` | `/serviceprediction/simulations/{id}` | Récupérer une simulation spécifique |

**Contextes automatiques intégrés** :
- Météorologique (pluviométrie, température)
- Économique (inflation, PIB)
- Démographique (population, croissance)

**Exemple** :
```bash
curl -X POST http://localhost:3000/serviceprediction/simulations \
  -H "Content-Type: application/json" \
  -d '{
    "revenueId": "uuid-recette",
    "newAmount": 2000,
    "city": "Antananarivo",
    "frequency": "monthly",
    "durationMonths": 12
  }'
```

---

### 🗺️ Marchés

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/serviceprediction/markets` | Récupérer marchés via API Overpass (OpenStreetMap) |
| `GET` | `/serviceprediction/markets/stored` | Lister marchés stockés en base |
| `GET` | `/serviceprediction/places/bbox` | Obtenir bounding box d'une ville (Nominatim) |
| `GET` | `/serviceprediction/markets/by-city` | Récupérer marchés automatiquement par ville |
| `GET` | `/serviceprediction/markets/normalized` | Lister marchés avec GeoJSON normalisé |

**Exemple** :
```bash
# Récupérer marchés d'Antananarivo
curl "http://localhost:3000/serviceprediction/markets/by-city?ville=Antananarivo"

# Bounding box d'une ville
curl "http://localhost:3000/serviceprediction/places/bbox?city=Fianarantsoa"
```

---

### ⚡ Optimisation

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/serviceprediction/analysis-results/{id}/enrich` | Enrichir avec interprétation IA (Gemini) |
| `POST` | `/serviceprediction/simulations/{id}/optimize` | Recommander meilleur timing d'implémentation |

**Fonctionnalités IA** :
- Analyse contextuelle des résultats
- Identification des risques et opportunités
- Recommandations de timing optimal

**Exemple** :
```bash
curl -X POST http://localhost:3000/serviceprediction/analysis-results/{id}/enrich
```

---

### ⚖️ Légalité (Validation de Recettes)

**NOUVEAU MODULE** - Validation réglementaire des recettes locales

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/serviceprediction/revenue-validation` | Valider et normaliser une recette |
| `GET` | `/serviceprediction/revenue-validation/history` | Historique des validations |
| `GET` | `/serviceprediction/revenue-validation/{id}` | Récupérer une validation spécifique |

#### 🔍 Fonctionnement de la validation

**Documents de référence** :
- PCOP 2006 CTD (Plan Comptable des Opérations Publiques)
- Code des Impôts modifié par la Loi de Finances 2025

**Processus** :
1. Utilisateur envoie un nom de recette (ex: "IFPB", "Taxe marché")
2. IA Gemini analyse par rapport aux documents légaux
3. Retourne :
   - **name** : Nom normalisé officiel (ou `null` si invalide)
   - **description** : Structure complète (base légale, nomenclature PCOP, assiette, taux, modalités)

**Cas d'usage** :

✅ **Recette valide** :
```bash
curl -X POST http://localhost:3000/serviceprediction/revenue-validation \
  -H "Content-Type: application/json" \
  -d '{
    "name": "IFPB",
    "municipality_id": "antananarivo-001"
  }'

# Réponse :
{
  "name": "Impôt Foncier sur la Propriété Bâtie (IFPB)",
  "description": "- Base légale : Code Général des Impôts, art. 10-01-01...\n- Nomenclature PCOP : Classe 6, Chapitre 60, Compte 601...\n- Nature : Recette fiscale (impôt direct)\n- Assiette : Valeur locative des propriétés bâties...\n- Taux : Taux fixé par délibération communale...\n- Modalités : Recouvrement par la Direction Générale des Impôts...",
  "municipality_id": "antananarivo-001"
}
```

❌ **Recette invalide** :
```bash
curl -X POST http://localhost:3000/serviceprediction/revenue-validation \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Recette XYZ inexistante",
    "municipality_id": "antananarivo-001"
  }'

# Réponse :
{
  "name": null,
  "description": "ERREUR : La recette fournie ne correspond à aucune recette clairement définie dans le PCOP 2006 ni dans le Code des Impôts...",
  "municipality_id": "antananarivo-001"
}
```

#### 📊 Statuts de validation

| Statut | Description |
|--------|-------------|
| `valid` | Recette conforme aux référentiels |
| `invalid` | Recette non reconnue ou illégale |
| `ambiguous` | Plusieurs correspondances possibles |
| `pending` | En cours d'analyse |
| `error` | Erreur technique |

#### 📝 Données stockées

Chaque validation enregistre :
- `originalName` : Nom saisi par l'utilisateur
- `normalizedName` : Nom officiel normalisé
- `description` : Description structurée complète
- `pcopReference` : Classe, chapitre, compte PCOP
- `legalReference` : Articles de loi, références LFI
- `revenueType` : Type de recette (fiscale, domaniale, etc.)
- `assiette` : Base de calcul
- `taux` : Taux applicable
- `modalitesRecouvrement` : Procédures de collecte
- `conditionsApplication` : Conditions spécifiques
- `rawAiResponse` : Réponse brute de l'IA (JSONB)

---

## 🔧 Configuration et tests

### Démarrer le serveur
```bash
npm run start:dev
```

### Accéder au Swagger UI
```
http://localhost:3000/serviceprediction/docs
```

### Tester la validation de recettes
```bash
# Script de test complet
node test-multiple-validations.js

# Test rapide
node test-revenue-validation-quick.js
```

---

## 📚 Documentation liée

- **[REVENUE_VALIDATION_MODULE.md](./REVENUE_VALIDATION_MODULE.md)** - Documentation technique complète du module
- **[QUICKSTART_REVENUE_VALIDATION.md](./QUICKSTART_REVENUE_VALIDATION.md)** - Guide de démarrage rapide
- **[IMPLEMENTATION_SUMMARY_REVENUE_VALIDATION.md](./IMPLEMENTATION_SUMMARY_REVENUE_VALIDATION.md)** - Résumé de l'implémentation
- **[PREDICTIONS_OVERVIEW.md](./PREDICTIONS_OVERVIEW.md)** - Système de prédictions quantitatives
- **[NOMINATIM_INTEGRATION_GUIDE.md](./NOMINATIM_INTEGRATION_GUIDE.md)** - Intégration OpenStreetMap/Nominatim

---

## 🛡️ Sécurité et performances

### Variables d'environnement requises
```env
# Base de données
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_NAME=revenue_db

# IA Gemini
GEMINI_API_KEY=your_gemini_api_key

# Service TensorFlow (optionnel)
TF_SERVICE_URL=http://localhost:8501
TF_SERVICE_ENABLED=true
```

### Rate limiting
- API Gemini : 15 requêtes/minute (gratuit)
- Pagination recommandée pour les listes : `?limit=50`

---

## 🚀 Roadmap

### Prochaines évolutions
- [ ] Authentification JWT
- [ ] Export PDF des analyses
- [ ] Dashboard temps réel
- [ ] Extraction automatique depuis PDFs (PCOP/Code Impôts)
- [ ] Support multi-langues (FR/MG)
- [ ] Cache Redis pour les validations fréquentes

---

**Version** : 1.0.0  
**Dernière mise à jour** : 27 novembre 2024  
**Auteur** : Équipe Mobilisation Recette Locale
