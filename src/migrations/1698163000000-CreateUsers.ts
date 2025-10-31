import { MigrationInterface, QueryRunner } from 'typeorm';

// Migration intentionally left as a no-op because user accounts / auth were
// removed from the project. Keeping the migration file avoids breaking
// migration ordering for existing environments.
export class CreateUsers1698163000000 implements MigrationInterface {
  name = 'CreateUsers1698163000000';

  public async up(_queryRunner: QueryRunner): Promise<void> {
    // no-op
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // no-op
  }
}
