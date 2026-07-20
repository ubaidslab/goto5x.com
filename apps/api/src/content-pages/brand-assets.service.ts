import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaRuntimeService } from "../prisma/prisma-runtime.service";
import { UpsertBrandAssetDto } from "./dto/upsert-brand-asset.dto";

/**
 * SRS FR-12.3 - platform brand assets (logo, favicon, hero images), the
 * same admin-editable-content mechanism as ContentPagesService (FR-12.1)
 * applied to a URL pointer rather than rich text. `kind` is a free-form
 * string ("logo" | "favicon" | "hero") rather than an enum, matching
 * SettingsDefinition's own precedent of not enum-ing every small fixed set.
 */
@Injectable()
export class BrandAssetsService {
  constructor(private readonly prisma: PrismaRuntimeService) {}

  async listAll() {
    return this.prisma.platformBrandAsset.findMany({ orderBy: { kind: "asc" } });
  }

  async getByKind(kind: string) {
    const asset = await this.prisma.platformBrandAsset.findUnique({ where: { kind } });
    if (!asset) throw new NotFoundException(`No brand asset found for kind "${kind}".`);
    return asset;
  }

  async upsert(kind: string, dto: UpsertBrandAssetDto, adminUserId: string) {
    const existing = await this.prisma.platformBrandAsset.findUnique({ where: { kind } });
    const nextVersion = (existing?.currentVersion ?? 0) + 1;

    const asset = await this.prisma.platformBrandAsset.upsert({
      where: { kind },
      create: { kind, url: dto.url, currentVersion: nextVersion },
      update: { url: dto.url, currentVersion: nextVersion },
    });
    await this.prisma.platformBrandAssetRevision.create({
      data: { brandAssetId: asset.id, version: nextVersion, url: dto.url, editedByAdminUserId: adminUserId },
    });
    return asset;
  }
}
