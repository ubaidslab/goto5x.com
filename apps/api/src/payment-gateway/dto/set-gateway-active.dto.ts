import { IsBoolean } from "class-validator";

export class SetGatewayActiveDto {
  @IsBoolean()
  isActive!: boolean;
}
