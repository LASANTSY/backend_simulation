import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGeometryToMarketplace1704000000000 implements MigrationInterface {
  name = 'AddGeometryToMarketplace1704000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "marketplace" ADD COLUMN IF NOT EXISTS "geometry" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "marketplace" DROP COLUMN IF EXISTS "geometry"`);
  }
}
