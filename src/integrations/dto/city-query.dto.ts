import { IsString, IsNotEmpty } from 'class-validator';

export class CityQueryDto {
  @IsString()
  @IsNotEmpty()
  city: string;
}
