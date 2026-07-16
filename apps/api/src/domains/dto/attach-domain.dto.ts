import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class AttachDomainDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(253) // max valid DNS hostname length
  domainName!: string;
}
