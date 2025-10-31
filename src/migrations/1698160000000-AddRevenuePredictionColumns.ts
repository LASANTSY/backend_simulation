import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRevenuePredictionColumns1698160000000 implements MigrationInterface {
  name = 'AddRevenuePredictionColumns1698160000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "revenue" ADD COLUMN IF NOT EXISTS "category" character varying`);
    await queryRunner.query(`ALTER TABLE "revenue" ADD COLUMN IF NOT EXISTS "parameters" jsonb`);
    await queryRunner.query(`ALTER TABLE "prediction" ADD COLUMN IF NOT EXISTS "lowerBound" numeric(12,2)`);
    await queryRunner.query(`ALTER TABLE "prediction" ADD COLUMN IF NOT EXISTS "upperBound" numeric(12,2)`);
    await queryRunner.query(`ALTER TABLE "prediction" ADD COLUMN IF NOT EXISTS "confidenceLevel" numeric`);
    await queryRunner.query(`ALTER TABLE "prediction" ADD COLUMN IF NOT EXISTS "period" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "prediction" DROP COLUMN IF EXISTS "period"`);
    await queryRunner.query(`ALTER TABLE "prediction" DROP COLUMN IF EXISTS "confidenceLevel"`);
    await queryRunner.query(`ALTER TABLE "prediction" DROP COLUMN IF EXISTS "upperBound"`);
    await queryRunner.query(`ALTER TABLE "prediction" DROP COLUMN IF EXISTS "lowerBound"`);
    await queryRunner.query(`ALTER TABLE "revenue" DROP COLUMN IF EXISTS "parameters"`);
    await queryRunner.query(`ALTER TABLE "revenue" DROP COLUMN IF EXISTS "category"`);
  }
}
