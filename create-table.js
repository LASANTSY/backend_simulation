/**
 * Script pour créer la table revenue_validation
 */

const { execSync } = require('child_process');
const AppDataSource = require('./dist/data-source').default;

async function createTable() {
  console.log('📊 Initialisation de la connexion à la base de données...\n');
  
  try {
    await AppDataSource.initialize();
    console.log('✅ Connexion établie\n');

    console.log('📝 Création de la table revenue_validation...\n');
    
    const queryRunner = AppDataSource.createQueryRunner();
    
    await queryRunner.query(`
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
    `);

    console.log('✅ Table créée\n');

    console.log('📊 Création des index...\n');

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_revenue_validation_municipality" 
      ON revenue_validation ("municipalityId");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_revenue_validation_status" 
      ON revenue_validation (status);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_revenue_validation_created_at" 
      ON revenue_validation ("createdAt" DESC);
    `);

    console.log('✅ Index créés\n');

    await queryRunner.release();
    await AppDataSource.destroy();

    console.log('✅ Table revenue_validation créée avec succès!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

createTable();
