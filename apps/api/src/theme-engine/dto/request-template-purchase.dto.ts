import { IsUUID } from "class-validator";

export class RequestTemplatePurchaseDto {
  @IsUUID()
  themeId!: string;
}
