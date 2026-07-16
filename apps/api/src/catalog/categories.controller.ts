import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { AdminAuthGuard } from "../common/guards/admin-auth.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PrismaRuntimeService } from "../prisma/prisma-runtime.service";
import { CreateCategoryDto } from "./dto/create-category.dto";

/**
 * `categories` is a global, admin-managed taxonomy (docs/database-schema.md)
 * with no RLS - every seller reads the same list. Module 2 ships only what
 * FR-2.1 needs to let a product reference a category (list + create); a full
 * admin CRUD surface (rename/retire) isn't required by any Module 2 FR and
 * is flagged as not covered in the verification report rather than built on
 * spec-writer's discretion.
 */
@Controller("categories")
export class CategoriesController {
  constructor(private readonly prisma: PrismaRuntimeService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  list() {
    return this.prisma.category.findMany({ orderBy: { name: "asc" } });
  }

  @Post()
  @UseGuards(AdminAuthGuard)
  create(@Body() dto: CreateCategoryDto) {
    return this.prisma.category.create({ data: dto });
  }
}
