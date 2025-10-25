import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ name: 'economic_indicator' })
export class EconomicIndicator {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  indicator: string; // e.g., NY.GDP.MKTP.CD

  @Column()
  country: string;

  @Column({ type: 'jsonb' })
  data: any;

  @CreateDateColumn()
  fetchedAt: Date;
}
