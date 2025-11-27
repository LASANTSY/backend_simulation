import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateRevenueValidation1733000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'revenue_validation',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'originalName',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'normalizedName',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'municipalityId',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'pending'",
          },
          {
            name: 'pcopReference',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'legalReference',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'revenueType',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'assiette',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'taux',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'modalitesRecouvrement',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'conditionsApplication',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'observations',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'rawAiResponse',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'errorMessage',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    // Créer des index pour améliorer les performances de recherche
    await queryRunner.query(
      `CREATE INDEX "IDX_revenue_validation_municipality" ON "revenue_validation" ("municipalityId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_revenue_validation_status" ON "revenue_validation" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_revenue_validation_created_at" ON "revenue_validation" ("createdAt" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_revenue_validation_created_at"`);
    await queryRunner.query(`DROP INDEX "IDX_revenue_validation_status"`);
    await queryRunner.query(`DROP INDEX "IDX_revenue_validation_municipality"`);
    await queryRunner.dropTable('revenue_validation');
  }
}
