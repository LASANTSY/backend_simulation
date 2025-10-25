import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPredictionMunicipality1699000000000 implements MigrationInterface {
  name = 'AddPredictionMunicipality1699000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "prediction" ADD COLUMN IF NOT EXISTS "municipalityId" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "prediction" DROP COLUMN IF EXISTS "municipalityId"`);
  }
}
