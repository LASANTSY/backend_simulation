"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddRevenuePredictionColumns1698160000000 = void 0;
class AddRevenuePredictionColumns1698160000000 {
    constructor() {
        this.name = 'AddRevenuePredictionColumns1698160000000';
    }
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "revenue" ADD COLUMN IF NOT EXISTS "category" character varying`);
        await queryRunner.query(`ALTER TABLE "revenue" ADD COLUMN IF NOT EXISTS "parameters" jsonb`);
        await queryRunner.query(`ALTER TABLE "prediction" ADD COLUMN IF NOT EXISTS "lowerBound" numeric(12,2)`);
        await queryRunner.query(`ALTER TABLE "prediction" ADD COLUMN IF NOT EXISTS "upperBound" numeric(12,2)`);
        await queryRunner.query(`ALTER TABLE "prediction" ADD COLUMN IF NOT EXISTS "confidenceLevel" numeric`);
        await queryRunner.query(`ALTER TABLE "prediction" ADD COLUMN IF NOT EXISTS "period" character varying`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "prediction" DROP COLUMN IF EXISTS "period"`);
        await queryRunner.query(`ALTER TABLE "prediction" DROP COLUMN IF EXISTS "confidenceLevel"`);
        await queryRunner.query(`ALTER TABLE "prediction" DROP COLUMN IF EXISTS "upperBound"`);
        await queryRunner.query(`ALTER TABLE "prediction" DROP COLUMN IF EXISTS "lowerBound"`);
        await queryRunner.query(`ALTER TABLE "revenue" DROP COLUMN IF EXISTS "parameters"`);
        await queryRunner.query(`ALTER TABLE "revenue" DROP COLUMN IF EXISTS "category"`);
    }
}
exports.AddRevenuePredictionColumns1698160000000 = AddRevenuePredictionColumns1698160000000;
//# sourceMappingURL=1698160000000-AddRevenuePredictionColumns.js.map