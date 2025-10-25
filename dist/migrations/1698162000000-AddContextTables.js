"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddContextTables1698162000000 = void 0;
class AddContextTables1698162000000 {
    constructor() {
        this.name = 'AddContextTables1698162000000';
    }
    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "weather_context" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "key" character varying NOT NULL, "data" jsonb NOT NULL, "fetchedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_weather_context" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "economic_indicator" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "indicator" character varying NOT NULL, "country" character varying NOT NULL, "data" jsonb NOT NULL, "fetchedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_economic_indicator" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "demographic" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "country" character varying NOT NULL, "data" jsonb NOT NULL, "fetchedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_demographic" PRIMARY KEY ("id"))`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS "demographic"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "economic_indicator"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "weather_context"`);
    }
}
exports.AddContextTables1698162000000 = AddContextTables1698162000000;
//# sourceMappingURL=1698162000000-AddContextTables.js.map