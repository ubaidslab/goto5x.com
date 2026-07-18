import { IsIn } from "class-validator";

// Kept in sync with apps/web's DASHBOARD_THEMES preset list (Module 10, FR-28.4).
export const DASHBOARD_THEME_IDS = ["default", "emerald", "amber", "rose"] as const;

export class UpdateDashboardThemeDto {
  @IsIn(DASHBOARD_THEME_IDS)
  dashboardTheme!: (typeof DASHBOARD_THEME_IDS)[number];
}
