import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ name: 'weather_context' })
export class WeatherContext {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  key: string; // e.g., lat_lon_date

  @Column({ type: 'jsonb' })
  data: any;

  @Column({ nullable: true })
  municipalityId?: string;

  @CreateDateColumn()
  fetchedAt: Date;
}
