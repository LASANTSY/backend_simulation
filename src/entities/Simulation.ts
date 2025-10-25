import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class Simulation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'jsonb', nullable: true })
  parameters?: any;

  @Column({ type: 'jsonb', nullable: true })
  weatherContext?: any;

  @Column({ type: 'jsonb', nullable: true })
  economicContext?: any;

  @Column({ type: 'jsonb', nullable: true })
  demographicContext?: any;

  @Column({ default: 'pending' })
  status: string;

  @Column({ nullable: true })
  municipalityId?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
