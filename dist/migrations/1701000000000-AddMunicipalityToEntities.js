"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddMunicipalityToEntities1701000000000 = void 0;
class AddMunicipalityToEntities1701000000000 {
    constructor() {
        this.name = 'AddMunicipalityToEntities1701000000000';
    }
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "revenue" ADD COLUMN IF NOT EXISTS "municipalityId" character varying`);
        await queryRunner.query(`ALTER TABLE "simulation" ADD COLUMN IF NOT EXISTS "municipalityId" character varying`);
        await queryRunner.query(`ALTER TABLE "analysis_result" ADD COLUMN IF NOT EXISTS "municipalityId" character varying`);
        await queryRunner.query(`ALTER TABLE "demographic" ADD COLUMN IF NOT EXISTS "municipalityId" character varying`);
        await queryRunner.query(`ALTER TABLE "economic_indicator" ADD COLUMN IF NOT EXISTS "municipalityId" character varying`);
        await queryRunner.query(`ALTER TABLE "weather_context" ADD COLUMN IF NOT EXISTS "municipalityId" character varying`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "weather_context" DROP COLUMN IF EXISTS "municipalityId"`);
        await queryRunner.query(`ALTER TABLE "economic_indicator" DROP COLUMN IF EXISTS "municipalityId"`);
        await queryRunner.query(`ALTER TABLE "demographic" DROP COLUMN IF EXISTS "municipalityId"`);
        await queryRunner.query(`ALTER TABLE "analysis_result" DROP COLUMN IF EXISTS "municipalityId"`);
        await queryRunner.query(`ALTER TABLE "simulation" DROP COLUMN IF EXISTS "municipalityId"`);
        await queryRunner.query(`ALTER TABLE "revenue" DROP COLUMN IF EXISTS "municipalityId"`);
    }
}
exports.AddMunicipalityToEntities1701000000000 = AddMunicipalityToEntities1701000000000;
//# sourceMappingURL=1701000000000-AddMunicipalityToEntities.js.map