import { IsBoolean, IsObject, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateSupplierAdapterDto {
  @IsString()
  @MaxLength(40)
  adapterType!: string;

  @IsString()
  @MaxLength(120)
  displayName!: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
