import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ name: 'marketplace' })
export class Marketplace {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'osm_id' })
  osm_id: string;

  @Column({ nullable: true })
  name?: string;

  @Column({ type: 'double precision', nullable: true })
  latitude?: number;

  @Column({ type: 'double precision', nullable: true })
  longitude?: number;

  @Column({ type: 'jsonb', nullable: true })
  tags?: any;

  @Column({ nullable: true })
  city?: string;

  @CreateDateColumn({ name: 'fetched_at' })
  fetched_at: Date;
}
