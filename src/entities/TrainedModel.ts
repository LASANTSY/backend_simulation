import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity()
export class TrainedModel {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  model_path!: string;

  @Column({ type: 'varchar', length: 64, default: 'unknown' })
  framework!: string;

  @Column({ type: 'json', nullable: true })
  hyperparams?: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  metrics?: Record<string, any>;

  @CreateDateColumn()
  training_date!: Date;
}

export default TrainedModel;
