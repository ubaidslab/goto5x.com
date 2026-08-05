import { IsString, MinLength } from "class-validator";

export class UnsubscribeCampaignDto {
  @IsString()
  @MinLength(1)
  token!: string;
}
