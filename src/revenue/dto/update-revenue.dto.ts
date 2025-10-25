import { IsNumber, Min, IsString, IsOptional, IsDateString, IsObject } from 'class-validator';

export class UpdateRevenueDto {
  @IsOptional()
  @IsNumber({}, { message: 'amount must be a number' })
  @Min(0, { message: 'amount must be >= 0' })
  amount?: number;

  @IsOptional()
  @IsDateString({}, { message: 'date must be an ISO date string' })
  date?: string;

  @IsOptional()
  @IsString({ message: 'category must be a string' })
  category?: string;

  @IsOptional()
  @IsString({ message: 'source must be a string' })
  source?: string;

  @IsOptional()
  @IsObject({ message: 'parameters must be an object' })
  parameters?: Record<string, any>;
}
