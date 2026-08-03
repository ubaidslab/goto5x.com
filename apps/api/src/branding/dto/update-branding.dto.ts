import { IsBoolean } from "class-validator";

export class UpdateBrandingDto {
  @IsBoolean()
  hidden!: boolean;
}
