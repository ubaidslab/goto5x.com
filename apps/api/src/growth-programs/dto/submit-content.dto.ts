import { IsIn, IsInt, IsUrl, Min, MaxLength } from "class-validator";
import { ContentPlatform } from "@prisma/client";

const PLATFORMS: ContentPlatform[] = ["tiktok", "instagram", "youtube", "snapchat", "facebook", "x", "pinterest"];

export class SubmitContentDto {
  @IsIn(PLATFORMS)
  platform!: ContentPlatform;

  @IsUrl()
  @MaxLength(2000)
  contentUrl!: string;

  @IsInt()
  @Min(0)
  reportedViews!: number;
}
