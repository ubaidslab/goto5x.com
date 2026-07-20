import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from "class-validator";

export class CreatePlatformMessageDto {
  @IsIn(["banner", "popup", "in_app_notification"])
  channel!: "banner" | "popup" | "in_app_notification";

  @IsOptional()
  @IsIn(["all", "plan", "seller"])
  targetType?: "all" | "plan" | "seller";

  @ValidateIf((o) => o.targetType === "plan")
  @IsUUID()
  targetPlanId?: string;

  @ValidateIf((o) => o.targetType === "seller")
  @IsUUID()
  targetSellerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsString()
  body!: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;
}
