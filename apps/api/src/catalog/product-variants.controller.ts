import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CreateVariantDto } from "./dto/create-variant.dto";
import { UpdateVariantDto } from "./dto/update-variant.dto";
import { ProductVariantsService } from "./product-variants.service";

@Controller("stores/:storeId/products/:productId/variants")
@UseGuards(JwtAuthGuard)
export class ProductVariantsController {
  constructor(private readonly variants: ProductVariantsService) {}

  @Post()
  create(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("productId") productId: string,
    @Body() dto: CreateVariantDto,
  ) {
    return this.variants.create(sellerId, storeId, productId, dto);
  }

  @Get()
  list(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("productId") productId: string,
  ) {
    return this.variants.list(sellerId, storeId, productId);
  }

  @Patch(":variantId")
  update(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("productId") productId: string,
    @Param("variantId") variantId: string,
    @Body() dto: UpdateVariantDto,
  ) {
    return this.variants.update(sellerId, storeId, productId, variantId, dto);
  }

  @Delete(":variantId")
  remove(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("productId") productId: string,
    @Param("variantId") variantId: string,
  ) {
    return this.variants.remove(sellerId, storeId, productId, variantId);
  }
}
