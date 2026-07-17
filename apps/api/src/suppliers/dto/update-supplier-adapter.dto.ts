import { IsBoolean, IsObject, IsOptional } from "class-validator";

export class UpdateSupplierAdapterDto {
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
