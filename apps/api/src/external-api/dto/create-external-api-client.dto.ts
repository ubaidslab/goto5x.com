import { ExternalApiClientType } from "@prisma/client";
import { IsEnum, IsString, MaxLength } from "class-validator";

/** FR-8.14 - admin registers one of the two external-SaaS hooks; `clientType` is unique, so a second create for the same type conflicts. */
export class CreateExternalApiClientDto {
  @IsEnum(ExternalApiClientType)
  clientType!: ExternalApiClientType;

  @IsString()
  @MaxLength(120)
  displayName!: string;
}
