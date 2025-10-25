import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSimulationContexts1700000000000 implements MigrationInterface {
  name = 'AddSimulationContexts1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "simulation" ADD COLUMN IF NOT EXISTS "weatherContext" jsonb`);
    await queryRunner.query(`ALTER TABLE "simulation" ADD COLUMN IF NOT EXISTS "economicContext" jsonb`);
    await queryRunner.query(`ALTER TABLE "simulation" ADD COLUMN IF NOT EXISTS "demographicContext" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "simulation" DROP COLUMN IF EXISTS "demographicContext"`);
    await queryRunner.query(`ALTER TABLE "simulation" DROP COLUMN IF EXISTS "economicContext"`);
    await queryRunner.query(`ALTER TABLE "simulation" DROP COLUMN IF EXISTS "weatherContext"`);
  }
}
