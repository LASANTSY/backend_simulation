import { IsString, IsArray, ArrayNotEmpty, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

class LabelItemDto {
  @IsOptional()
  @IsString()
  key?: string;

  // value can be string/number; keep simple validation
  @IsOptional()
  value?: any;
}

export class CreateLabelDto {
  @IsString()
  dataset_id: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => LabelItemDto)
  labels: LabelItemDto[];
}

export default CreateLabelDto;
