import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameCategoryToName1705000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Rename column category to name in revenue table
    await queryRunner.query(`ALTER TABLE "revenue" RENAME COLUMN "category" TO "name"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert: rename column name back to category
    await queryRunner.query(`ALTER TABLE "revenue" RENAME COLUMN "name" TO "category"`);
  }
}
