import { IsUUID, IsNumber, Min, IsOptional, IsString, IsIn, IsDateString, IsObject, IsDefined } from 'class-validator';

export class CreateSimulationDto {
  @IsUUID()
  revenueId: string;

  @IsNumber({}, { message: 'newAmount must be a number' })
  @Min(0, { message: 'newAmount must be >= 0' })
  newAmount: number;

  // frequency for the simulated revenue: 'monthly' or 'annual'
  @IsString()
  @IsIn(['monthly', 'annual'])
  frequency: 'monthly' | 'annual';

  // duration in months (if frequency is annual, duration will be converted to years inside service)
  @IsNumber({}, { message: 'durationMonths must be a number' })
  @Min(1)
  durationMonths: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsString()
  note?: string;

  // Contexts fournis directement lors de la création de la simulation
  @IsDefined({ message: 'weatherContext is required' })
  @IsObject()
  weatherContext: any;

  @IsDefined({ message: 'economicContext is required' })
  @IsObject()
  economicContext: any;

  @IsDefined({ message: 'demographicContext is required' })
  @IsObject()
  demographicContext: any;
}
