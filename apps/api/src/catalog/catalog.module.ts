import { Module } from "@nestjs/common";
import { ModerationModule } from "../moderation/moderation.module";
import { CategoriesController } from "./categories.controller";
import { ProductVariantsController } from "./product-variants.controller";
import { ProductVariantsService } from "./product-variants.service";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";

@Module({
  imports: [ModerationModule],
  controllers: [ProductsController, ProductVariantsController, CategoriesController],
  providers: [ProductsService, ProductVariantsService],
  exports: [ProductsService, ProductVariantsService],
})
export class CatalogModule {}
