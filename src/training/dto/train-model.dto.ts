import { IsString, IsOptional, IsObject, IsIn, IsNotEmpty } from 'class-validator';

export class TrainModelDto {
  @IsString()
  @IsNotEmpty()
  dataset_id!: string;

  @IsObject()
  hyperparams!: Record<string, any>;

  @IsOptional()
  @IsString()
  @IsIn(['sklearn', 'pytorch', 'tensorflow'])
  framework?: string;
}
