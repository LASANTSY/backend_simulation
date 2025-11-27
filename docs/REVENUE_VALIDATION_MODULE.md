# Module de Validation de Recettes Locales Malgaches

Ce module permet de valider et normaliser les recettes locales proposées par les utilisateurs en les confrontant aux normes légales et comptables en vigueur à Madagascar.

## Contexte

Le module analyse les recettes selon deux référentiels principaux :
- **PCOP 2006 CTD** : Plan Comptable des Opérations Publiques pour les Collectivités Territoriales Décentralisées
- **Code des Impôts** : Version mise à jour selon la Loi de Finances 2025

## Architecture

### Composants créés

1. **Entité** : `RevenueValidation` (`src/entities/RevenueValidation.ts`)
   - Stocke les validations de recettes avec toutes les métadonnées
   - Champs : nom original, nom normalisé, description, statut, références légales, etc.

2. **DTOs** : (`src/revenue-validation/dto/`)
   - `ValidateRevenueRequestDto` : Requête de validation (name, municipality_id)
   - `ValidateRevenueResponseDto` : Réponse structurée avec nom normalisé et description

3. **Service** : `RevenueValidationService` (`src/revenue-validation/revenue-validation.service.ts`)
   - Logique métier principale
   - Intégration avec l'API Gemini pour l'analyse IA
   - Parsing et structuration des réponses
   - Gestion de l'historique

4. **Contrôleur** : Express Router (`src/revenue-validation/revenue-validation.controller.ts`)
   - Routes REST pour l'API
   - Validation des entrées
   - Gestion des erreurs

5. **Migration** : `1733000000000-CreateRevenueValidation.ts`
   - Crée la table `revenue_validation` avec tous les champs nécessaires
   - Index optimisés pour les recherches

## API Endpoints

### POST /serviceprediction/revenue-validation

Valide une recette locale proposée.

**Requête** :
```json
{
  "name": "Taxe marché municipal",
  "municipality_id": "municipality-uuid-123"
}
```

**Réponse (recette valide)** :
```json
{
  "name": "Taxe sur les emplacements dans les marchés municipaux",
  "description": "Base légale : Code des Impôts, Article XXX...\nNomenclature PCOP : Classe 7, Chapitre...\nNature : Recette fiscale locale...\n...",
  "municipality_id": "municipality-uuid-123"
}
```

**Réponse (recette non conforme)** :
```json
{
  "name": null,
  "description": "ERREUR : La recette fournie ne correspond à aucune recette clairement définie...",
  "municipality_id": "municipality-uuid-123"
}
```

**Réponse (recette ambiguë)** :
```json
{
  "name": null,
  "description": "AMBIGUÏTÉ : Le nom de recette fourni correspond potentiellement à plusieurs recettes officielles...",
  "municipality_id": "municipality-uuid-123"
}
```

### GET /serviceprediction/revenue-validation/history

Récupère l'historique des validations.

**Paramètres** :
- `municipalityId` (optionnel) : Filtrer par municipalité

**Réponse** :
```json
[
  {
    "id": "uuid",
    "originalName": "Taxe marché municipal",
    "normalizedName": "Taxe sur les emplacements dans les marchés municipaux",
    "description": "...",
    "municipalityId": "...",
    "status": "valid",
    "pcopReference": {...},
    "legalReference": {...},
    "revenueType": "fiscale",
    "createdAt": "2024-11-27T10:00:00Z",
    "updatedAt": "2024-11-27T10:00:00Z"
  }
]
```

### GET /serviceprediction/revenue-validation/:id

Récupère une validation spécifique par son ID.

**Réponse** : Objet `RevenueValidation` complet

## Configuration

### Variables d'environnement requises

```env
# API Key pour Gemini
GEMINI_API_KEY=your-gemini-api-key

# Modèle Gemini à utiliser (optionnel)
GEMINI_MODEL=gemini-2.5-flash
```

### Documents de référence

Les documents suivants doivent être présents dans `/ressource` :
- `guide-pcop-2006-collectivites-territoriales-decentralisees.pdf`
- `Code des Impots suivant la loi de finances 2025.pdf`

## Statuts de validation

- `pending` : Validation en cours
- `valid` : Recette valide et normalisée
- `invalid` : Recette non conforme aux textes
- `ambiguous` : Plusieurs interprétations possibles
- `error` : Erreur technique lors de la validation

## Fonctionnement détaillé

### Processus de validation

1. **Réception de la requête** : L'utilisateur soumet un nom de recette
2. **Analyse initiale** : Détection d'abréviations, erreurs orthographiques, etc.
3. **Recherche documentaire** : Le prompt contient les références aux documents PCOP et Code des Impôts
4. **Appel IA** : Gemini analyse la recette selon les référentiels
5. **Parsing** : Extraction et structuration de la réponse JSON
6. **Enrichissement** : Extraction des métadonnées (base légale, assiette, taux, etc.)
7. **Persistance** : Sauvegarde en base de données
8. **Réponse** : Retour du résultat au client

### Extraction des métadonnées

Le service extrait automatiquement depuis la description :
- Base légale et références aux articles
- Nomenclature PCOP (classe, chapitre, compte)
- Nature de la recette (fiscale, non-fiscale, domaniale)
- Assiette (base imposable)
- Taux ou montants
- Modalités de recouvrement
- Conditions d'application
- Observations

## Utilisation

### Exemple TypeScript/JavaScript

```typescript
import axios from 'axios';

const response = await axios.post('http://localhost:3000/serviceprediction/revenue-validation', {
  name: 'IFPB',
  municipality_id: 'antananarivo-001'
});

console.log(response.data);
// {
//   name: "Impôt Foncier sur les Propriétés Bâties (IFPB)",
//   description: "Base légale : ...",
//   municipality_id: "antananarivo-001"
// }
```

### Exemple cURL

```bash
curl -X POST http://localhost:3000/serviceprediction/revenue-validation \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Taxe marché",
    "municipality_id": "fianarantsoa-001"
  }'
```

## Améliorations futures

1. **Extraction PDF** : Implémenter l'extraction réelle du texte des PDFs pour enrichir le contexte de l'IA
2. **Cache** : Mettre en cache les validations fréquentes pour améliorer les performances
3. **Suggestions** : Proposer des recettes similaires en cas d'erreur
4. **Multi-langue** : Support du français et du malgache
5. **Webhooks** : Notifications pour les validations longues
6. **Export** : Génération de rapports PDF des validations

## Tests

Pour tester le module après l'avoir déployé :

```bash
# Lancer les migrations
npm run migration:run

# Démarrer le serveur
npm run dev

# Tester l'endpoint
curl -X POST http://localhost:3000/serviceprediction/revenue-validation \
  -H "Content-Type: application/json" \
  -d '{"name": "Taxe marché", "municipality_id": "test-001"}'
```

## Maintenance

- Monitorer les logs pour détecter les erreurs d'analyse
- Vérifier régulièrement les mises à jour du Code des Impôts
- Ajuster les prompts IA en fonction des résultats observés
- Nettoyer périodiquement les validations anciennes si nécessaire

## Support

Pour toute question ou problème :
1. Consulter les logs de l'application
2. Vérifier que GEMINI_API_KEY est configurée
3. Vérifier que les documents PDF sont présents dans `/ressource`
4. Consulter la documentation Swagger à `/serviceprediction/docs`
