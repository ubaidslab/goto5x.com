import { Module } from "@nestjs/common";
import {
  AdminBrandAssetsController,
  AdminContentPagesController,
  BrandAssetsController,
  ContentPagesController,
} from "./content-pages.controller";
import { BrandAssetsService } from "./brand-assets.service";
import { ContentPagesService } from "./content-pages.service";

@Module({
  controllers: [ContentPagesController, AdminContentPagesController, BrandAssetsController, AdminBrandAssetsController],
  providers: [ContentPagesService, BrandAssetsService],
  exports: [ContentPagesService, BrandAssetsService],
})
export class ContentPagesModule {}
