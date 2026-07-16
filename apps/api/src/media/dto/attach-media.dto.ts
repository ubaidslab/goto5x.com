import { IsOptional, IsUUID } from "class-validator";

export class AttachMediaDto {
  @IsOptional()
  @IsUUID()
  productId?: string;
}
