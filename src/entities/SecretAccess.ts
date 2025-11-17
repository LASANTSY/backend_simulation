import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity()
export class SecretAccess {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 128 })
  secret_key!: string;

  @Column({ type: 'varchar', length: 32 })
  source!: string;

  @CreateDateColumn()
  accessed_at!: Date;
}

export default SecretAccess;
