import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  storeName?: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(300)
  members: string[];

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(300)
  menus: string[];
}

export class SetClosedDto {
  @IsBoolean()
  closed: boolean;
}

export class OwnerOrderDto {
  @IsUUID()
  first: string;

  @IsOptional()
  @IsUUID()
  alt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  memo?: string;
}
