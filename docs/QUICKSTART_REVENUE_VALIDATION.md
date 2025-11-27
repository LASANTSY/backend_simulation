# Guide de Démarrage Rapide - Module de Validation de Recettes

## 📋 Prérequis

1. **Base de données PostgreSQL** configurée et accessible
2. **API Key Gemini** : Obtenez-en une sur [Google AI Studio](https://makersuite.google.com/app/apikey)
3. **Documents de référence** dans `/ressource` :
   - `guide-pcop-2006-collectivites-territoriales-decentralisees.pdf`
   - `Code des Impots suivant la loi de finances 2025.pdf`

## 🚀 Installation et Configuration

### Étape 1 : Configurer les variables d'environnement

Ajoutez à votre fichier `.env` :

```bash
GEMINI_API_KEY=votre-cle-api-gemini
GEMINI_MODEL=gemini-2.5-flash
```

### Étape 2 : Exécuter la migration de base de données

```bash
npm run migration:run
```

Cela créera la table `revenue_validation` avec tous les champs nécessaires.

### Étape 3 : Démarrer le serveur

```bash
npm run dev
```

Le serveur démarrera sur `http://localhost:3000` (ou le port configuré dans `APP_PORT`).

## 🧪 Tester le Module

### Test rapide avec cURL

```bash
curl -X POST http://localhost:3000/serviceprediction/revenue-validation \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Taxe marché municipal",
    "municipality_id": "test-001"
  }'
```

### Test avec le script fourni

```bash
node scripts/test-revenue-validation.js
```

Ce script exécutera plusieurs tests automatiques et affichera les résultats.

## 📝 Exemples d'Utilisation

### Exemple 1 : Valider une recette avec nom complet

```bash
curl -X POST http://localhost:3000/serviceprediction/revenue-validation \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Taxe sur les emplacements dans les marchés municipaux",
    "municipality_id": "antananarivo-001"
  }'
```

**Réponse attendue** :
```json
{
  "name": "Taxe sur les emplacements dans les marchés municipaux",
  "description": "Base légale : Code des Impôts...\nNomenclature PCOP : ...",
  "municipality_id": "antananarivo-001"
}
```

### Exemple 2 : Valider une abréviation

```bash
curl -X POST http://localhost:3000/serviceprediction/revenue-validation \
  -H "Content-Type: application/json" \
  -d '{
    "name": "IFPB",
    "municipality_id": "fianarantsoa-001"
  }'
```

**Réponse attendue** :
```json
{
  "name": "Impôt Foncier sur les Propriétés Bâties (IFPB)",
  "description": "Base légale : Code des Impôts, Article...\n...",
  "municipality_id": "fianarantsoa-001"
}
```

### Exemple 3 : Récupérer l'historique

```bash
curl http://localhost:3000/serviceprediction/revenue-validation/history
```

### Exemple 4 : Filtrer par municipalité

```bash
curl "http://localhost:3000/serviceprediction/revenue-validation/history?municipalityId=antananarivo-001"
```

## 🔍 Vérification de l'Installation

### Vérifier que les documents sont présents

```bash
ls ressource/
```

Vous devriez voir :
- `guide-pcop-2006-collectivites-territoriales-decentralisees.pdf`
- `Code des Impots suivant la loi de finances 2025.pdf`

### Vérifier que la table existe

```sql
SELECT * FROM revenue_validation LIMIT 1;
```

### Vérifier les logs

Les logs du service apparaissent avec le préfixe `[RevenueValidation]` :

```
[RevenueValidation] Validation de la recette: Taxe marché municipal pour la municipalité: test-001
[RevenueValidation] Document PCOP 2006 CTD trouvé
[RevenueValidation] Document Code des Impôts (LFI 2025) trouvé
[RevenueValidation] Réponse reçue de Gemini API
```

## ⚠️ Résolution de Problèmes

### Erreur : "GEMINI_API_KEY non configurée"

**Solution** : Ajoutez `GEMINI_API_KEY=votre-cle` dans le fichier `.env`

### Erreur : "Document PCOP 2006 CTD non trouvé"

**Solution** : Placez le PDF dans le dossier `ressource/` avec le nom exact

### Erreur : "Échec de l'appel à l'API Gemini"

**Causes possibles** :
1. Clé API invalide ou expirée
2. Quota API dépassé
3. Problème de connexion internet

**Solution** : Vérifiez votre clé API et les logs détaillés de l'erreur

### Erreur de parsing de la réponse IA

**Cause** : Gemini n'a pas retourné un JSON valide

**Solution** : Vérifiez les logs pour voir la réponse brute, ajustez le prompt si nécessaire

## 📊 Swagger Documentation

Accédez à la documentation interactive Swagger :

```
http://localhost:3000/serviceprediction/docs
```

Recherchez la section **Revenue Validation** pour tester l'API directement depuis le navigateur.

## 🔄 Workflow Typique

1. **L'utilisateur soumet** un nom de recette via l'interface frontend
2. **Le backend valide** les données d'entrée
3. **Le service analyse** la recette avec l'IA Gemini
4. **La réponse est parsée** et structurée
5. **Les données sont sauvegardées** en base de données
6. **Le résultat est retourné** au client

## 📈 Monitoring

Surveillez les métriques suivantes :
- Temps de réponse de l'API Gemini
- Taux de succès/échec des validations
- Nombre de validations par municipalité
- Types de recettes les plus fréquemment validées

## 🎯 Prochaines Étapes

Une fois le module opérationnel :

1. **Intégrer** au frontend pour permettre aux utilisateurs de valider leurs recettes
2. **Analyser** les résultats pour identifier les recettes problématiques
3. **Enrichir** la base de connaissances avec les retours des utilisateurs
4. **Optimiser** les prompts en fonction des résultats observés
5. **Implémenter** l'extraction des PDFs pour un contexte plus riche

## 📚 Documentation Complète

Pour plus de détails, consultez :
- [`docs/REVENUE_VALIDATION_MODULE.md`](./REVENUE_VALIDATION_MODULE.md) - Documentation complète du module
- Code source dans `src/revenue-validation/`
- Schéma de la base de données dans `src/migrations/1733000000000-CreateRevenueValidation.ts`

## 💡 Conseils

- Commencez par des tests avec des recettes bien connues (IFPB, Taxe marché, etc.)
- Analysez les descriptions retournées pour vérifier la qualité de l'analyse
- Gardez un œil sur les quotas de l'API Gemini
- Sauvegardez régulièrement la base de données pour conserver l'historique
