import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { ThemesService } from "./themes.service";

@Controller("themes")
@UseGuards(JwtAuthGuard)
export class ThemesController {
  constructor(private readonly themes: ThemesService) {}

  @Get()
  list() {
    return this.themes.listSelectable();
  }
}
