# Commandes Essentielles - Module de Validation de Recettes

## 🚀 Installation et Configuration

### 1. Configurer les variables d'environnement
```bash
# Ajouter à votre fichier .env
echo "GEMINI_API_KEY=votre-cle-api" >> .env
echo "GEMINI_MODEL=gemini-2.5-flash" >> .env
```

### 2. Exécuter la migration
```bash
npm run migration:run
```

### 3. Démarrer le serveur
```bash
npm run dev
```

## 🧪 Tests

### Test rapide avec cURL
```bash
# Test basique
curl -X POST http://localhost:3000/serviceprediction/revenue-validation \
  -H "Content-Type: application/json" \
  -d '{"name": "Taxe marché municipal", "municipality_id": "test-001"}'

# Test avec abréviation
curl -X POST http://localhost:3000/serviceprediction/revenue-validation \
  -H "Content-Type: application/json" \
  -d '{"name": "IFPB", "municipality_id": "test-002"}'

# Récupérer l'historique
curl http://localhost:3000/serviceprediction/revenue-validation/history

# Filtrer par municipalité
curl "http://localhost:3000/serviceprediction/revenue-validation/history?municipalityId=test-001"
```

### Test avec le script automatique
```bash
node scripts/test-revenue-validation.js
```

## 📊 Base de Données

### Vérifier la table
```sql
SELECT * FROM revenue_validation LIMIT 10;
```

### Compter les validations par statut
```sql
SELECT status, COUNT(*) 
FROM revenue_validation 
GROUP BY status;
```

### Voir les dernières validations
```sql
SELECT 
  "originalName", 
  "normalizedName", 
  status, 
  "municipalityId",
  "createdAt"
FROM revenue_validation 
ORDER BY "createdAt" DESC 
LIMIT 20;
```

### Rechercher une recette spécifique
```sql
SELECT * 
FROM revenue_validation 
WHERE "originalName" ILIKE '%marché%';
```

## 🔍 Débogage

### Vérifier les documents de référence
```bash
# Windows PowerShell
Test-Path "ressource\guide-pcop-2006-collectivites-territoriales-decentralisees.pdf"
Test-Path "ressource\Code des Impots suivant la loi de finances 2025.pdf"
```

### Vérifier la configuration Gemini
```bash
# Afficher la valeur (attention : sensible!)
echo $env:GEMINI_API_KEY
```

### Voir les logs en temps réel
```bash
# Les logs du module commencent par [RevenueValidation]
# Surveillez la console lors de l'exécution
```

## 🧹 Maintenance

### Nettoyer les anciennes validations
```sql
-- Supprimer les validations de plus de 90 jours
DELETE FROM revenue_validation 
WHERE "createdAt" < NOW() - INTERVAL '90 days';
```

### Réinitialiser une validation en erreur
```sql
UPDATE revenue_validation 
SET status = 'pending' 
WHERE id = 'votre-uuid-ici';
```

### Exporter les validations
```sql
-- Exporter en CSV (PostgreSQL)
COPY (
  SELECT * FROM revenue_validation 
  WHERE "municipalityId" = 'votre-municipality-id'
) TO '/tmp/validations.csv' CSV HEADER;
```

## 📈 Monitoring

### Statistiques de validation
```sql
-- Taux de succès
SELECT 
  ROUND(100.0 * SUM(CASE WHEN status = 'valid' THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate,
  COUNT(*) as total_validations
FROM revenue_validation;

-- Répartition par municipalité
SELECT 
  "municipalityId",
  COUNT(*) as total,
  SUM(CASE WHEN status = 'valid' THEN 1 ELSE 0 END) as valid,
  SUM(CASE WHEN status = 'invalid' THEN 1 ELSE 0 END) as invalid
FROM revenue_validation
GROUP BY "municipalityId"
ORDER BY total DESC;
```

### Recettes les plus validées
```sql
SELECT 
  "normalizedName",
  COUNT(*) as count
FROM revenue_validation
WHERE status = 'valid'
GROUP BY "normalizedName"
ORDER BY count DESC
LIMIT 10;
```

## 🔧 Développement

### Compiler TypeScript
```bash
npm run build
```

### Lancer en mode watch
```bash
npm run dev
```

### Exécuter les tests (à créer)
```bash
npm test -- revenue-validation
```

## 🐳 Docker (si applicable)

### Reconstruire avec le nouveau module
```bash
docker-compose build backend
docker-compose up -d
```

### Voir les logs du container
```bash
docker-compose logs -f backend
```

### Exécuter la migration dans Docker
```bash
docker-compose exec backend npm run migration:run
```

## 📦 Production

### Build pour production
```bash
npm run build
NODE_ENV=production npm start
```

### Sauvegarder la base de données
```bash
# PostgreSQL backup
pg_dump -U username -d database_name -t revenue_validation > revenue_validation_backup.sql
```

### Restaurer la base de données
```bash
psql -U username -d database_name < revenue_validation_backup.sql
```

## 🆘 Résolution de Problèmes

### Erreur : Module not found
```bash
# Réinstaller les dépendances
rm -rf node_modules package-lock.json
npm install
```

### Erreur : Cannot connect to database
```bash
# Vérifier la connexion PostgreSQL
psql -U username -d database_name -c "SELECT 1"
```

### Erreur : Gemini API quota exceeded
```bash
# Vérifier votre quota sur Google AI Studio
# https://makersuite.google.com/app/apikey
# Attendre ou upgrader votre plan
```

### Erreur : PDF not found
```bash
# Vérifier que les PDFs sont au bon endroit
ls -la ressource/
# Les copier si nécessaire
cp /path/to/pdfs/* ressource/
```

## 📚 Ressources Utiles

- Documentation complète : `docs/REVENUE_VALIDATION_MODULE.md`
- Guide de démarrage : `docs/QUICKSTART_REVENUE_VALIDATION.md`
- Résumé d'implémentation : `docs/IMPLEMENTATION_SUMMARY_REVENUE_VALIDATION.md`
- API Swagger : `http://localhost:3000/serviceprediction/docs`

## 💡 Tips

- Commencez toujours par des tests simples (IFPB, Taxe marché)
- Surveillez les quotas Gemini API
- Gardez un backup régulier de la base de données
- Analysez les réponses pour améliorer les prompts
- Documentez les nouvelles recettes découvertes
