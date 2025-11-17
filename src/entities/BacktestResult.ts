import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { TrainedModel } from './TrainedModel';

@Entity()
export class BacktestResult {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => TrainedModel)
  @JoinColumn({ name: 'model_id' })
  model!: TrainedModel;

  @Column({ type: 'uuid' })
  model_id!: string;

  @Column({ type: 'json', nullable: true })
  metrics?: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  predictions?: any[];

  @Column({ type: 'json', nullable: true })
  actuals?: any[];

  @Column({ type: 'varchar', length: 32, nullable: true })
  period_start?: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  period_end?: string;

  @CreateDateColumn()
  created_at!: Date;
}

export default BacktestResult;
