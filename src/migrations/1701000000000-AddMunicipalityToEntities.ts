import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMunicipalityToEntities1701000000000 implements MigrationInterface {
  name = 'AddMunicipalityToEntities1701000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "revenue" ADD COLUMN IF NOT EXISTS "municipalityId" character varying`);
    await queryRunner.query(`ALTER TABLE "simulation" ADD COLUMN IF NOT EXISTS "municipalityId" character varying`);
    await queryRunner.query(`ALTER TABLE "analysis_result" ADD COLUMN IF NOT EXISTS "municipalityId" character varying`);
    await queryRunner.query(`ALTER TABLE "demographic" ADD COLUMN IF NOT EXISTS "municipalityId" character varying`);
    await queryRunner.query(`ALTER TABLE "economic_indicator" ADD COLUMN IF NOT EXISTS "municipalityId" character varying`);
    await queryRunner.query(`ALTER TABLE "weather_context" ADD COLUMN IF NOT EXISTS "municipalityId" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "weather_context" DROP COLUMN IF EXISTS "municipalityId"`);
    await queryRunner.query(`ALTER TABLE "economic_indicator" DROP COLUMN IF EXISTS "municipalityId"`);
    await queryRunner.query(`ALTER TABLE "demographic" DROP COLUMN IF EXISTS "municipalityId"`);
    await queryRunner.query(`ALTER TABLE "analysis_result" DROP COLUMN IF EXISTS "municipalityId"`);
    await queryRunner.query(`ALTER TABLE "simulation" DROP COLUMN IF EXISTS "municipalityId"`);
    await queryRunner.query(`ALTER TABLE "revenue" DROP COLUMN IF EXISTS "municipalityId"`);
  }
}
