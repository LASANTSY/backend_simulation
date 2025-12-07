# Dictionnaire de données — Backend Simulation

Ce document fournit le dictionnaire de données des principales entités du projet. Format suivi pour chaque champ :

`<nom_champ>` <Description courte>
`<Type>` `<Taille/format>` <Contraintes / Remarques>

Exemple de format :
`id_action_complaint` Identifiant unique de l’action de suivi de la plainte
`AN` `50` Clé primaire, format CUID

---

## 1) RevenueValidation

`id` Identifiant unique de la validation de recette
`CUID/UUID` `50` Clé primaire

`municipality_id` Identifiant de la municipalité
`AN` `50` Référence vers `Municipality.id`

`original_name` Nom fourni par l'utilisateur / municipalité
`AN` `255` Texte original soumis

`normalized_name` Nom normalisé (PCOP/LFI) ou `null` si non trouvé
`AN` `255` Valeur normalisée selon référentiel

`status` Statut de la validation
`AN` `20` Enum: `valid`, `invalid`, `ambiguous`, `pending`

`description` Description structurée et base légale (texte en français)
`TEXT` - Contient base légale, PCOP, assiette, taux, modalités

`ai_response` Réponse brute/structurée renvoyée par le moteur AI
`JSONB` - Stocke le JSON renvoyé pour audit

`legal_references` Références légales extraites (liste structurée)
`JSONB` - Exemple: [{"code":"LFI-2025-art-...","text":"..."}]

`created_by` Identifiant de l'utilisateur ayant déclenché la validation
`AN` `50` Référence vers `User.id` (optionnel)

`created_at` Date de création
`TIMESTAMP` - UTC

`updated_at` Date de dernière mise à jour
`TIMESTAMP` - UTC

---

## 2) Municipality

`id` Identifiant unique de la municipalité
`AN` `50` Clé primaire (ex: `antananarivo-001`)

`name` Nom complet de la municipalité
`AN` `255`

`code` Code interne ou INSEE/local
`AN` `50` Valeur unique si disponible

`region` Région ou province
`AN` `100`

`population` Population estimée
`N` - Entier (nullable)

`contact_email` Email de contact administrative
`AN` `255` (nullable)

`created_at` Date de création
`TIMESTAMP` - UTC

`updated_at` Date de mise à jour
`TIMESTAMP` - UTC

---

## 3) User

`id` Identifiant unique de l'utilisateur
`CUID/UUID` `50` Clé primaire

`username` Nom de connexion
`AN` `100` Unique

`full_name` Nom complet
`AN` `255`

`email` Adresse email
`AN` `255` Unique

`role` Rôle applicatif
`AN` `50` Enum: `admin`, `editor`, `viewer`, `service`

`last_login_at` Dernière connexion
`TIMESTAMP` - UTC (nullable)

`created_at` Création du compte
`TIMESTAMP`

`updated_at` Mise à jour du compte
`TIMESTAMP`

---

## 4) Simulation

`id` Identifiant unique de la simulation
`CUID/UUID` `50` Clé primaire

`municipality_id` Municipalité ciblée
`AN` `50` Référence vers `Municipality.id`

`parameters` Paramètres d'entrée de la simulation
`JSONB` - Structure libre: saisons, recettes ciblées, horizon, etc.

`context_ids` Références aux contexts utilisés
`JSONB` - Exemple: ["ctx-uuid-1","ctx-uuid-2"]

`status` Statut de la simulation
`AN` `20` Enum: `pending`, `running`, `completed`, `failed`

`result_summary` Résumé texte des résultats
`TEXT` - Courte synthèse

`created_by` Utilisateur initiateur
`AN` `50` Référence `User.id`

`created_at` Date de lancement
`TIMESTAMP`

`completed_at` Date de fin (nullable)
`TIMESTAMP` (nullable)

---

## 5) Prediction

`id` Identifiant unique de la prédiction
`CUID/UUID` `50` Clé primaire

`simulation_id` Référence vers la simulation source
`CUID/UUID` `50` Foreign key -> `Simulation.id`

`method` Méthode de prédiction utilisée
`AN` `100` Ex: `linear_regression`, `nn_v1`, `seasonal_model`

`parameters` Paramètres spécifiques à la méthode
`JSONB` - Hyperparamètres, features sélectionnées

`result` Résultat brut (séries, valeurs prédites)
`JSONB` - Ex: {"dates":[...],"values":[...]} 

`confidence` Confiance ou intervalle
`NUMERIC` - Valeur 0.0–1.0 ou null

`metrics` Métriques d'évaluation (RMSE, MAE, etc.)
`JSONB` - Exemple: {"rmse":1.23, "mae":0.98}

`created_at` Date
`TIMESTAMP`

---

## 6) AI_Call_Log

`id` Identifiant unique de l'appel AI
`CUID/UUID` `50` Clé primaire

`model` Modèle utilisé
`AN` `100` Ex: `gemini-2.0-flash`

`prompt` Prompt envoyé au modèle
`TEXT` - Stocker pour audit/diagnostic

`response` Réponse complète du modèle
`JSONB` - Stocke le JSON renvoyé

`parsed_output` Données extraites / normalisées
`JSONB` - Contenu utilisé par l'application

`tokens_used` Nombre de tokens consommés (si disponible)
`N` - Entier (nullable)

`duration_ms` Durée de l'appel en millisecondes
`N` - Entier (nullable)

`status` Statut de l'appel
`AN` `20` Enum: `ok`, `error`, `timeout`

`created_at` Horodatage
`TIMESTAMP`

---

## 7) Context

`id` Identifiant unique du contexte
`CUID/UUID` `50` Clé primaire

`municipality_id` Municipalité concernée
`AN` `50` Référence `Municipality.id` (nullable si global)

`context_type` Type de contexte
`AN` `50` Ex: `economic`, `demographic`, `market`, `custom`

`content` Contenu structuré du contexte
`JSONB` - Données utiles pour l'enrichissement des simulations

`source` Origine du contexte
`AN` `100` Ex: `open-data`, `user-provided`, `inferred`

`created_at` Date
`TIMESTAMP`

`updated_at` Date
`TIMESTAMP`

---

## 8) Revenue_Catalog

`id` Identifiant interne de la recette
`AN` `50` Clé primaire (ex: code interne PCOP)

`official_name` Nom officiel normalisé
`AN` `255` Nom selon PCOP / LFI

`aliases` Synonymes / variantes connues
`JSONB` - Ex: ["taxe marché","redevance marché"]

`pcop_code` Code PCOP (si disponible)
`AN` `50` Nullable

`description` Description et modalité
`TEXT` - Base légale, assiette, modalités

`category` Catégorie / famille
`AN` `100` Ex: `taxe`, `redevance`, `amende`

`created_at` Date
`TIMESTAMP`

`updated_at` Date
`TIMESTAMP`

---

## 9) Backtest

`id` Identifiant du backtest
`CUID/UUID` `50` Clé primaire

`prediction_id` Référence à la prédiction testée
`CUID/UUID` `50` -> `Prediction.id`

`actual_values` Valeurs réelles observées
`JSONB` - Séries temporelles observées

`error_metrics` Résultats d'évaluation (RMSE, MAPE…)
`JSONB` - Ex: {"rmse":2.1, "mape":4.5}

`run_by` Utilisateur ou processus ayant lancé le backtest
`AN` `50` -> `User.id` (nullable)

`run_at` Date d'exécution
`TIMESTAMP`

`notes` Observations qualitatives
`TEXT` (nullable)

---

## Annexes

- Types recommandés :
  - `AN` = Alphanumérique / chaîne
  - `N` = Numérique
  - `JSONB` = Colonne JSON (Postgres)
  - `TEXT` = Texte libre long
  - `TIMESTAMP` = Horodatage UTC
  - `CUID/UUID` = Identifiant unique (format CUID ou UUID)

- Conventions :
  - Tous les horodatages doivent être en UTC.
  - Les champs JSONB doivent suivre un schéma minimal documenté côté application.
  - Les relations FK stockent l'identifiant externe (`id`) et non l'objet complet.

---

Si tu veux, je peux :
- générer un export CSV/TSV de ce dictionnaire ;
- ajouter des exemples concrets pour chaque champ ;
- intégrer ce fichier dans la documentation automatique (Swagger ou README).

Indique ce que tu préfères comme prochaine étape.