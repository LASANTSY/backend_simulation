import { IsUUID, IsNumber, Min, IsOptional, IsString, IsIn, IsDateString, IsObject } from 'class-validator';

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

  // Currency for the simulation results (devise). Defaults to 'MGA' if not provided.
  @IsOptional()
  @IsString()
  devise?: string;

  // Contexts fournis directement lors de la création de la simulation
  // Contexts fournis directement lors de la création de la simulation.
  // They are now optional: if omitted, the server will attempt to fetch them automatically based on `city`.
  @IsOptional()
  @IsObject()
  weatherContext?: any;

  @IsOptional()
  @IsObject()
  economicContext?: any;

  @IsOptional()
  @IsObject()
  demographicContext?: any;

  // Optional season context (will be inferred if not provided)
  @IsOptional()
  @IsObject()
  seasonContext?: any;

  // City used to fetch contexts automatically (required if contexts are not provided)
  @IsString()
  city?: string;
}
