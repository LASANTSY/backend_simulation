import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ name: 'demographic' })
export class Demographic {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  country: string;

  @Column({ type: 'jsonb' })
  data: any;

  @Column({ nullable: true })
  municipalityId?: string;

  @CreateDateColumn()
  fetchedAt: Date;
}
