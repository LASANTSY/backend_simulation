-- Création de la table revenue_validation
-- Exécuter cette requête SQL dans votre base de données PostgreSQL

CREATE TABLE IF NOT EXISTS revenue_validation (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "originalName" VARCHAR NOT NULL,
  "normalizedName" VARCHAR,
  description TEXT,
  "municipalityId" VARCHAR,
  status VARCHAR(50) DEFAULT 'pending',
  "pcopReference" JSONB,
  "legalReference" JSONB,
  "revenueType" VARCHAR(100),
  assiette TEXT,
  taux TEXT,
  "modalitesRecouvrement" TEXT,
  "conditionsApplication" TEXT,
  observations TEXT,
  "rawAiResponse" JSONB,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Création des index
CREATE INDEX IF NOT EXISTS "IDX_revenue_validation_municipality" ON revenue_validation ("municipalityId");
CREATE INDEX IF NOT EXISTS "IDX_revenue_validation_status" ON revenue_validation (status);
CREATE INDEX IF NOT EXISTS "IDX_revenue_validation_created_at" ON revenue_validation ("createdAt" DESC);

-- Vérifier la création
SELECT tablename FROM pg_tables WHERE tablename = 'revenue_validation';
