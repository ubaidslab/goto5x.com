import { IsString, MinLength } from "class-validator";

export class PublishAgreementVersionDto {
  @IsString()
  @MinLength(1)
  version!: string;
}
