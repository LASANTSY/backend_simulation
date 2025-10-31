"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateMarketplaces1703000000000 = void 0;
class CreateMarketplaces1703000000000 {
    constructor() {
        this.name = 'CreateMarketplaces1703000000000';
    }
    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "marketplace" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "osm_id" character varying NOT NULL, "name" character varying, "latitude" double precision, "longitude" double precision, "tags" jsonb, "city" character varying, "fetched_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_marketplace" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_marketplace_osm_id" ON "marketplace" ("osm_id")`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_marketplace_osm_id"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "marketplace"`);
    }
}
exports.CreateMarketplaces1703000000000 = CreateMarketplaces1703000000000;
//# sourceMappingURL=1703000000000-CreateMarketplaces.js.map