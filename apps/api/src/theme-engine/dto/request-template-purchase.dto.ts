import { IsOptional, IsString, IsUUID } from "class-validator";

export class RequestTemplatePurchaseDto {
  @IsUUID()
  themeId!: string;

  /** Platform Merchant Connection (founder-directed) - optional; only meaningful when the platform gateway is connected and active, otherwise ignored and the manual flow proceeds unchanged. */
  @IsOptional()
  @IsString()
  reference?: string;
}
