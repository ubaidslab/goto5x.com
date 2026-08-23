import { IsNotEmpty, IsString } from "class-validator";

export class CancelSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
