import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMarketplaces1703000000000 implements MigrationInterface {
  name = 'CreateMarketplaces1703000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "marketplace" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "osm_id" character varying NOT NULL, "name" character varying, "latitude" double precision, "longitude" double precision, "tags" jsonb, "city" character varying, "fetched_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_marketplace" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_marketplace_osm_id" ON "marketplace" ("osm_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_marketplace_osm_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "marketplace"`);
  }
}
