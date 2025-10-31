import { IsOptional, IsInt, Min, IsString } from 'class-validator';

export class PredictionRunDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  months?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  years?: number;

  @IsOptional()
  @IsString()
  municipalityId?: string;
}
