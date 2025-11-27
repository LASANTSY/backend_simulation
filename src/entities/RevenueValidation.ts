import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class RevenueValidation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  originalName: string;

  @Column({ nullable: true })
  normalizedName?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ nullable: true })
  municipalityId?: string;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status: 'valid' | 'invalid' | 'ambiguous' | 'pending' | 'error';

  @Column({ type: 'jsonb', nullable: true })
  pcopReference?: {
    classe?: string;
    chapitre?: string;
    compte?: string;
    rubrique?: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  legalReference?: {
    articles?: string[];
    sections?: string[];
    chapter?: string;
    loi?: string;
  };

  @Column({ type: 'varchar', length: 100, nullable: true })
  revenueType?: string; // fiscale, non-fiscale, domaniale, etc.

  @Column({ type: 'text', nullable: true })
  assiette?: string;

  @Column({ type: 'text', nullable: true })
  taux?: string;

  @Column({ type: 'text', nullable: true })
  modalitesRecouvrement?: string;

  @Column({ type: 'text', nullable: true })
  conditionsApplication?: string;

  @Column({ type: 'text', nullable: true })
  observations?: string;

  @Column({ type: 'jsonb', nullable: true })
  rawAiResponse?: any;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
