import { IsBoolean } from "class-validator";

export class SetPlatformGatewayActiveDto {
  @IsBoolean()
  isActive!: boolean;
}
