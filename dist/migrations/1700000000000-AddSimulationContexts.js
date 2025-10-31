"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddSimulationContexts1700000000000 = void 0;
class AddSimulationContexts1700000000000 {
    constructor() {
        this.name = 'AddSimulationContexts1700000000000';
    }
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "simulation" ADD COLUMN IF NOT EXISTS "weatherContext" jsonb`);
        await queryRunner.query(`ALTER TABLE "simulation" ADD COLUMN IF NOT EXISTS "economicContext" jsonb`);
        await queryRunner.query(`ALTER TABLE "simulation" ADD COLUMN IF NOT EXISTS "demographicContext" jsonb`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "simulation" DROP COLUMN IF EXISTS "demographicContext"`);
        await queryRunner.query(`ALTER TABLE "simulation" DROP COLUMN IF EXISTS "economicContext"`);
        await queryRunner.query(`ALTER TABLE "simulation" DROP COLUMN IF EXISTS "weatherContext"`);
    }
}
exports.AddSimulationContexts1700000000000 = AddSimulationContexts1700000000000;
//# sourceMappingURL=1700000000000-AddSimulationContexts.js.map