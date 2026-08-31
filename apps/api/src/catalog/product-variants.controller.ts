import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { RequireStaffScope } from "../common/decorators/require-staff-scope.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { StaffScopeGuard } from "../common/guards/staff-scope.guard";
import { CreateVariantDto } from "./dto/create-variant.dto";
import { UpdateVariantDto } from "./dto/update-variant.dto";
import { ProductVariantsService } from "./product-variants.service";

/** SRS §5.52/FR-52.2 - variants are part of the `catalog` scope, same as their parent product. */
@Controller("stores/:storeId/products/:productId/variants")
@UseGuards(JwtAuthGuard, StaffScopeGuard)
export class ProductVariantsController {
  constructor(private readonly variants: ProductVariantsService) {}

  @Post()
  @RequireStaffScope("catalog")
  create(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("productId") productId: string,
    @Body() dto: CreateVariantDto,
  ) {
    return this.variants.create(sellerId, storeId, productId, dto);
  }

  @Get()
  @RequireStaffScope("catalog", "read")
  list(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("productId") productId: string,
  ) {
    return this.variants.list(sellerId, storeId, productId);
  }

  @Patch(":variantId")
  @RequireStaffScope("catalog")
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
  @RequireStaffScope("catalog")
  remove(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("productId") productId: string,
    @Param("variantId") variantId: string,
  ) {
    return this.variants.remove(sellerId, storeId, productId, variantId);
  }
}
