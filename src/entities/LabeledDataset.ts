import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export type SplitType = 'train' | 'test' | 'validation' | 'full';

@Entity()
export class LabeledDataset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  datasetId: string;

  @Column({ type: 'jsonb' })
  labels: any; // array of label objects

  @Column({ type: 'varchar', default: 'full' })
  splitType: SplitType;

  @CreateDateColumn()
  createdAt: Date;
}

export default LabeledDataset;
