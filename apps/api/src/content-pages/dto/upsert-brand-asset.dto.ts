import { IsUrl } from "class-validator";

export class UpsertBrandAssetDto {
  @IsUrl({ require_tld: false })
  url!: string;
}
