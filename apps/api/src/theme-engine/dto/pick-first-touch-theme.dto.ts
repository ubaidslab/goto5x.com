import { IsIn } from "class-validator";

/** Phase 2 item 13 - the Home page onboarding wizard's Light/Dark starter picker. Never a raw themeId - see StoreThemeSettingsService.pickFirstTouchTheme(). */
export class PickFirstTouchThemeDto {
  @IsIn(["light", "dark"])
  choice!: "light" | "dark";
}
