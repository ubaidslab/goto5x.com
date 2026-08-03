-- Templates module (v0.31 design phase) - deliberate, non-alphabetical
-- ordering for theme default-assignment (StoresService.create()) and
-- picker listing (ThemesService.listSelectable()), now that the built-in
-- catalog grows from 3 structurally-only-distinct themes to 4 named
-- templates + a "Start from blank" option.
ALTER TABLE "themes" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;
