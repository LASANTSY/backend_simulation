"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddPredictionMunicipality1699000000000 = void 0;
class AddPredictionMunicipality1699000000000 {
    constructor() {
        this.name = 'AddPredictionMunicipality1699000000000';
    }
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "prediction" ADD COLUMN IF NOT EXISTS "municipalityId" character varying`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "prediction" DROP COLUMN IF EXISTS "municipalityId"`);
    }
}
exports.AddPredictionMunicipality1699000000000 = AddPredictionMunicipality1699000000000;
//# sourceMappingURL=1699000000000-AddPredictionMunicipality.js.map