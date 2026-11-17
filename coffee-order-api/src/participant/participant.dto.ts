import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class VerifyPinDto {
  @Matches(/^[0-9]{4}$/, { message: 'invalid_pin_format' })
  pin: string;
}

export class SubmitOrderDto {
  @Matches(/^[0-9]{4}$/, { message: 'invalid_pin_format' })
  pin: string;

  @IsUUID()
  first: string;

  @IsOptional() // null 또는 생략 허용
  @IsUUID()
  alt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  memo?: string;
}
