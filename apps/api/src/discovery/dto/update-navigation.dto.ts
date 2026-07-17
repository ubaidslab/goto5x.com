import { IsArray, IsObject } from "class-validator";

/**
 * `items` deliberately stays a loosely-typed JSON array, same reasoning as
 * StoreThemeSettings.settings (Module 4) - the shape (link/text_block/
 * social_links) is documented in docs/database-schema.md, but a rigid
 * nested DTO per item type would need a migration every time the shape
 * evolves. The frontend customizer/navigation editor is the one place that
 * actually constructs this array correctly.
 */
export class UpdateNavigationDto {
  @IsArray()
  @IsObject({ each: true })
  items!: Record<string, unknown>[];
}
