import { Body, Controller, ForbiddenException, Get, Param, Put, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AdminAuthGuard } from "../common/guards/admin-auth.guard";
import { JwtAccessPayload } from "../common/types";
import { BrandAssetsService } from "./brand-assets.service";
import { ContentPagesService } from "./content-pages.service";
import { UpsertBrandAssetDto } from "./dto/upsert-brand-asset.dto";
import { UpsertContentPageDto } from "./dto/upsert-content-page.dto";

function assertAdminUserId(user: JwtAccessPayload): asserts user is JwtAccessPayload & { adminUserId: string } {
  if (!user.adminUserId) {
    // Unreachable in practice - AdminAuthGuard already requires this.
    throw new ForbiddenException("This endpoint requires an authenticated admin session.");
  }
}

/** SRS FR-12.1 - public reads (platform site, no auth) + admin-only versioned writes. */
@Controller("content-pages")
export class ContentPagesController {
  constructor(private readonly contentPages: ContentPagesService) {}

  @Get()
  listAll() {
    return this.contentPages.listAll();
  }

  @Get(":slug")
  getBySlug(@Param("slug") slug: string) {
    return this.contentPages.getBySlug(slug);
  }
}

@Controller("admin/content-pages")
@UseGuards(AdminAuthGuard)
export class AdminContentPagesController {
  constructor(private readonly contentPages: ContentPagesService) {}

  @Get()
  listAll() {
    return this.contentPages.listAll();
  }

  @Get(":slug/revisions")
  listRevisions(@Param("slug") slug: string) {
    return this.contentPages.listRevisions(slug);
  }

  @Put(":slug")
  upsert(@CurrentUser() user: JwtAccessPayload, @Param("slug") slug: string, @Body() dto: UpsertContentPageDto) {
    assertAdminUserId(user);
    return this.contentPages.upsert(slug, dto, user.adminUserId);
  }
}

/** SRS FR-12.3 - same public-read/admin-write split as content pages above. */
@Controller("brand-assets")
export class BrandAssetsController {
  constructor(private readonly brandAssets: BrandAssetsService) {}

  @Get()
  listAll() {
    return this.brandAssets.listAll();
  }

  @Get(":kind")
  getByKind(@Param("kind") kind: string) {
    return this.brandAssets.getByKind(kind);
  }
}

@Controller("admin/brand-assets")
@UseGuards(AdminAuthGuard)
export class AdminBrandAssetsController {
  constructor(private readonly brandAssets: BrandAssetsService) {}

  @Get()
  listAll() {
    return this.brandAssets.listAll();
  }

  @Put(":kind")
  upsert(@CurrentUser() user: JwtAccessPayload, @Param("kind") kind: string, @Body() dto: UpsertBrandAssetDto) {
    assertAdminUserId(user);
    return this.brandAssets.upsert(kind, dto, user.adminUserId);
  }
}
