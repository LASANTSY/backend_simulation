import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
import { Revenue } from './Revenue';

@Entity()
export class Prediction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Revenue, { nullable: true })
  revenue?: Revenue;

  @Column({ type: 'date' })
  predictedDate: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  predictedAmount: number;

  @Column({ nullable: true })
  model?: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  lowerBound?: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  upperBound?: number;

  @Column({ type: 'numeric', nullable: true })
  confidenceLevel?: number;

  @Column({ nullable: true })
  period?: string; // e.g. 'monthly' or 'annual'

  @Column({ nullable: true })
  municipalityId?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
