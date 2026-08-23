import { ArrayMinSize, IsArray, IsIn, IsUUID } from "class-validator";

export class BulkDecideWalletTopUpsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  topUpIds!: string[];

  @IsIn(["verify", "reject"])
  decision!: "verify" | "reject";
}
