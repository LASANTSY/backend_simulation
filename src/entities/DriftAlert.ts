import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity()
export class DriftAlert {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @CreateDateColumn()
  detected_at!: Date;

  @Column({ type: 'varchar', length: 128 })
  metric_name!: string;

  @Column({ type: 'double precision', nullable: true })
  p_value?: number;

  @Column({ type: 'double precision', nullable: true })
  psi?: number;

  @Column({ type: 'varchar', length: 32 })
  severity!: string;

  @Column({ type: 'json', nullable: true })
  details?: Record<string, any>;
}

export default DriftAlert;
