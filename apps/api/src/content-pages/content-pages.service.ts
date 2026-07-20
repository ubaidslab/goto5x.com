import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaRuntimeService } from "../prisma/prisma-runtime.service";
import { UpsertContentPageDto } from "./dto/upsert-content-page.dto";

/**
 * SRS FR-12.1 - platform content pages (Terms of Service, Privacy Policy,
 * Refund Policy, About, Contact) as versioned, admin-editable rich-text.
 * Global, admin-gated at the application layer (AdminAuthGuard) - no RLS,
 * same category as SettingsDefinition/ExternalApiClient.
 */
@Injectable()
export class ContentPagesService {
  constructor(private readonly prisma: PrismaRuntimeService) {}

  async listAll() {
    return this.prisma.contentPage.findMany({ orderBy: { slug: "asc" } });
  }

  async getBySlug(slug: string) {
    const page = await this.prisma.contentPage.findUnique({ where: { slug } });
    if (!page) throw new NotFoundException(`No content page found for slug "${slug}".`);
    return page;
  }

  /** Creates the page on first write for a new slug, otherwise creates a new version - never overwrites history. */
  async upsert(slug: string, dto: UpsertContentPageDto, adminUserId: string) {
    const existing = await this.prisma.contentPage.findUnique({ where: { slug } });
    const nextVersion = (existing?.currentVersion ?? 0) + 1;

    const page = await this.prisma.contentPage.upsert({
      where: { slug },
      create: { slug, title: dto.title, bodyHtml: dto.bodyHtml, currentVersion: nextVersion },
      update: { title: dto.title, bodyHtml: dto.bodyHtml, currentVersion: nextVersion },
    });
    await this.prisma.contentPageRevision.create({
      data: {
        contentPageId: page.id,
        version: nextVersion,
        title: dto.title,
        bodyHtml: dto.bodyHtml,
        editedByAdminUserId: adminUserId,
      },
    });
    return page;
  }

  async listRevisions(slug: string) {
    const page = await this.getBySlug(slug);
    return this.prisma.contentPageRevision.findMany({
      where: { contentPageId: page.id },
      orderBy: { version: "desc" },
    });
  }
}
