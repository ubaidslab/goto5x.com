import { IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreateCampaignDto {
  @IsUUID()
  segmentId!: string;

  @IsUUID()
  senderEmailId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  subject!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  body!: string;
}
