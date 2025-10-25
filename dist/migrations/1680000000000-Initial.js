"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Initial1680000000000 = void 0;
class Initial1680000000000 {
    constructor() {
        this.name = 'Initial1680000000000';
    }
    async up(queryRunner) {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE TABLE "revenue" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "date" date NOT NULL, "amount" numeric(12,2) NOT NULL, "source" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_revenue_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "simulation" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "parameters" jsonb, "status" character varying NOT NULL DEFAULT 'pending', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_simulation_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "prediction" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "predictedDate" date NOT NULL, "predictedAmount" numeric(12,2) NOT NULL, "model" character varying, "revenueId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_prediction_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "analysis_result" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "resultData" jsonb, "summary" character varying, "simulationId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_analysis_result_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "prediction" ADD CONSTRAINT "FK_prediction_revenue" FOREIGN KEY ("revenueId") REFERENCES "revenue"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "analysis_result" ADD CONSTRAINT "FK_analysis_simulation" FOREIGN KEY ("simulationId") REFERENCES "simulation"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "analysis_result" DROP CONSTRAINT "FK_analysis_simulation"`);
        await queryRunner.query(`ALTER TABLE "prediction" DROP CONSTRAINT "FK_prediction_revenue"`);
        await queryRunner.query(`DROP TABLE "analysis_result"`);
        await queryRunner.query(`DROP TABLE "prediction"`);
        await queryRunner.query(`DROP TABLE "simulation"`);
        await queryRunner.query(`DROP TABLE "revenue"`);
    }
}
exports.Initial1680000000000 = Initial1680000000000;
//# sourceMappingURL=1680000000000-Initial.js.map