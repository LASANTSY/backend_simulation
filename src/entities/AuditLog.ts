import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity()
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  user_id?: string;

  @Column({ type: 'varchar', length: 256 })
  endpoint!: string;

  @Column({ type: 'json', nullable: true })
  request_body?: any;

  @Column({ type: 'int', nullable: true })
  response_status?: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  method?: string;

  @CreateDateColumn()
  timestamp!: Date;
}

export default AuditLog;
