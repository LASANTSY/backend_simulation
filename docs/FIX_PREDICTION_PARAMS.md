# 🔧 Fix : PredictionMethods utilise maintenant les données de la requête HTTP

## 🐛 Problème identifié

Les logs montraient toujours les mêmes valeurs par défaut :
```
[PredictionMethods] Starting multi-method prediction for: { 
  city: 'Antananarivo',  // ❌ Toujours la même valeur
  recipeType: 'TVA',     // ❌ Toujours la même valeur
  hasHistorical: false 
}
```

**Même quand la requête HTTP contenait** `"city": "Toamasina"`

---

## 🔍 Cause racine

Le code dans `ai.service.ts` cherchait les valeurs dans `sim.parameters` :

```typescript
const city = (sim?.parameters as any)?.city || 'Antananarivo';
const recipeType = (sim?.parameters as any)?.recipeType || 'TVA';
```

**MAIS** ces champs n'étaient jamais stockés dans `sim.parameters` !

Le flux était :
1. ✅ Requête HTTP POST : `{ "city": "Toamasina", "revenueId": "..." }`
2. ✅ Controller récupère `dto.city`
3. ❌ Service **ne stockait PAS** `city` dans `sim.parameters`
4. ❌ AI Service ne trouvait rien → utilisait valeurs par défaut

---

## ✅ Solution implémentée

### 1️⃣ Stocker `city` et `recipeType` dans `sim.parameters`

**Fichier** : `src/simulation/simulation.service.ts`

```typescript
const sim = this.simulationRepo.create({
  parameters: {
    revenueId: opts.revenueId,
    originalAmount: Number(revenue.amount),
    newAmount: opts.newAmount,
    // ... autres champs
    city: opts.city ?? null,           // ✅ NOUVEAU : Ville depuis requête HTTP
    recipeType: revenueCategoryName,   // ✅ NOUVEAU : Type depuis revenue.name
  },
  // ...
});
```

### 2️⃣ Ajouter `city` dans la signature du service

**Fichier** : `src/simulation/simulation.service.ts`

```typescript
async createAndRunSimulation(opts: {
  revenueId: string;
  newAmount: number;
  // ... autres paramètres
  city?: string;  // ✅ NOUVEAU
}) {
```

### 3️⃣ Passer `city` depuis le controller

**Fichier** : `src/simulation/simulation.controller.ts`

```typescript
const result = await simulationService.createAndRunSimulation({
  revenueId: dto.revenueId,
  newAmount: dto.newAmount,
  // ... autres paramètres
  city: dto.city,  // ✅ NOUVEAU : Transmet la ville depuis la requête HTTP
});
```

### 4️⃣ Améliorer les logs pour debug

**Fichier** : `src/ai/ai.service.ts`

```typescript
console.log('[AI enrichAnalysis] Applying prediction methods with:', {
  city,
  recipeType,
  fromParameters: {
    city: (sim?.parameters as any)?.city,        // Affiche la valeur trouvée
    recipeType: (sim?.parameters as any)?.recipeType
  }
});
```

---

## 📊 Résultat attendu

### Avant (avec le bug)
```json
POST /serviceprediction/simulations
{
  "city": "Toamasina",
  "revenueId": "68a0d073-6549-4eb9-888b-6f37c55df59a",
  "newAmount": 100000
}
```

**Logs** :
```
[PredictionMethods] Starting multi-method prediction for: {
  city: 'Antananarivo',  // ❌ Valeur par défaut ignorait "Toamasina"
  recipeType: 'TVA'
}
```

### Après (avec le fix)
```json
POST /serviceprediction/simulations
{
  "city": "Toamasina",
  "revenueId": "68a0d073-6549-4eb9-888b-6f37c55df59a",
  "newAmount": 100000
}
```

**Logs** :
```
[AI enrichAnalysis] Applying prediction methods with: {
  city: 'Toamasina',  // ✅ Valeur depuis requête HTTP
  recipeType: 'TVA',  // ✅ Valeur depuis revenue.name
  fromParameters: { city: 'Toamasina', recipeType: 'TVA' }
}

[PredictionMethods] Starting multi-method prediction for: {
  city: 'Toamasina',  // ✅ Correctement transmis
  recipeType: 'TVA',
  hasHistorical: false
}
```

---

## 🧪 Test recommandé

```bash
# Test avec différentes villes
curl -X POST http://localhost:3000/serviceprediction/simulations \
  -H "Content-Type: application/json" \
  -d '{
    "city": "Mahajanga",
    "revenueId": "68a0d073-6549-4eb9-888b-6f37c55df59a",
    "newAmount": 150000,
    "frequency": "monthly",
    "durationMonths": 12,
    "startDate": "2025-06-01"
  }'
```

**Vérifier dans les logs** :
```
[AI enrichAnalysis] Applying prediction methods with: {
  city: 'Mahajanga',  // ✅ Doit correspondre à la requête
  recipeType: '...',
  fromParameters: { city: 'Mahajanga', recipeType: '...' }
}
```

---

## 📋 Origine du recipeType

Le `recipeType` provient maintenant de `revenue.name` :

| revenue.name | recipeType dans logs |
|-------------|---------------------|
| "TVA" | 'TVA' |
| "Impôt foncier" | 'Impôt foncier' |
| "Taxe professionnelle" | 'Taxe professionnelle' |
| "Taxe locale" | 'Taxe locale' |
| null/undefined | 'Unknown' |

**Heuristiques sectorielles correspondantes** (dans `prediction-methods.ts`) :
- TVA → 3.5% croissance
- Impôt foncier → 2.0% croissance
- Taxe professionnelle → 4.0% croissance
- Taxe locale → 2.5% croissance
- Default → 3.0% croissance

---

## 📚 Fichiers modifiés

1. ✅ `src/simulation/simulation.service.ts` - Stocker city et recipeType
2. ✅ `src/simulation/simulation.controller.ts` - Passer city
3. ✅ `src/ai/ai.service.ts` - Améliorer logs

---

## 🎯 Impact

✅ Les prédictions utilisent maintenant les **vraies données** de la requête HTTP  
✅ Les heuristiques sectorielles s'appliquent au **bon type de recette**  
✅ Le fallback géographique utilise la **bonne ville**  
✅ Les logs sont plus **informatifs** pour le debug  

---

**Date** : 25 novembre 2025  
**Version** : 1.1.0
