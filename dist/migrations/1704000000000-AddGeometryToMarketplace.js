"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddGeometryToMarketplace1704000000000 = void 0;
class AddGeometryToMarketplace1704000000000 {
    constructor() {
        this.name = 'AddGeometryToMarketplace1704000000000';
    }
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "marketplace" ADD COLUMN IF NOT EXISTS "geometry" jsonb`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "marketplace" DROP COLUMN IF EXISTS "geometry"`);
    }
}
exports.AddGeometryToMarketplace1704000000000 = AddGeometryToMarketplace1704000000000;
//# sourceMappingURL=1704000000000-AddGeometryToMarketplace.js.map