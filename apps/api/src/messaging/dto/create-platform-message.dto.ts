import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, IsUrl, Max, MaxLength, Min, ValidateIf } from "class-validator";

export class CreatePlatformMessageDto {
  @IsIn(["banner", "popup", "in_app_notification"])
  channel!: "banner" | "popup" | "in_app_notification";

  @IsOptional()
  @IsIn(["all", "plan", "seller", "supplier"])
  targetType?: "all" | "plan" | "seller" | "supplier";

  @ValidateIf((o) => o.targetType === "plan")
  @IsUUID()
  targetPlanId?: string;

  @ValidateIf((o) => o.targetType === "seller")
  @IsUUID()
  targetSellerId?: string;

  @ValidateIf((o) => o.targetType === "supplier")
  @IsUUID()
  targetSupplierId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsString()
  body!: string;

  // Same plain-URL pattern as PlatformBrandAsset - no MediaAsset FK, since
  // MediaAsset.storeId is required and this content is global, not store-scoped.
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2000)
  imageUrl?: string;

  // Phase 3 item 17 (SRS FR-8.22) - the shown-count-limit trigger, an
  // alternative/additional gate to the startsAt/endsAt date-range trigger
  // below. Only enforced for the popup channel (see PlatformMessagesService).
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  maxShownCount?: number;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;
}
