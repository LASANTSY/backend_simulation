import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
import { Simulation } from './Simulation';

@Entity()
export class AnalysisResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Simulation, { nullable: true })
  simulation?: Simulation;

  @Column({ type: 'jsonb', nullable: true })
  resultData?: any;

  @Column({ nullable: true })
  summary?: string;

  @Column({ nullable: true })
  municipalityId?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
