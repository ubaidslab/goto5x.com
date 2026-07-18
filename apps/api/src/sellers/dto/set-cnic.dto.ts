import { IsString, MaxLength } from "class-validator";

export class SetCnicDto {
  @IsString()
  @MaxLength(20) // raw input may include dashes, normalized/validated in SellerIdentityService
  cnic!: string;
}
