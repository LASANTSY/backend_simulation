import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity()
export class ProductionPrediction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  model_id?: string;

  @Column({ type: 'json', nullable: true })
  features?: Record<string, any>;

  @Column({ type: 'double precision', nullable: true })
  prediction?: number;

  @Column({ type: 'double precision', nullable: true })
  latency_ms?: number;

  @Column({ type: 'boolean', default: true })
  success!: boolean;

  @CreateDateColumn()
  created_at!: Date;
}

export default ProductionPrediction;
