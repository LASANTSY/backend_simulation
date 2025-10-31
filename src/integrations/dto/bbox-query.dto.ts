import { IsNumber, Min, Max, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class BboxQueryDto {
  @IsOptional()
  @IsString()
  city?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  south: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  west: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  north: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  east: number;
}
