import { IsString } from "class-validator";

/** Supplier-initiated request (FR-3.1): identifies the store by its slug. */
export class RequestStoreLinkDto {
  @IsString()
  storeSlug!: string;
}
