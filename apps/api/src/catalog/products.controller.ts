import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { RequireStaffScope } from "../common/decorators/require-staff-scope.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { StaffScopeGuard } from "../common/guards/staff-scope.guard";
import { CreateProductDto } from "./dto/create-product.dto";
import { ProductListQueryDto } from "./dto/product-list-query.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { ProductsService } from "./products.service";

/** SRS §5.52/FR-52.2 - a staff session needs the `catalog` scope to reach any route here. */
@Controller("stores/:storeId/products")
@UseGuards(JwtAuthGuard, StaffScopeGuard)
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Post()
  @RequireStaffScope("catalog")
  create(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Body() dto: CreateProductDto) {
    return this.products.create(sellerId, storeId, dto);
  }

  @Get()
  @RequireStaffScope("catalog", "read")
  list(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Query() query: ProductListQueryDto) {
    return this.products.list(sellerId, storeId, query);
  }

  @Get(":productId")
  @RequireStaffScope("catalog", "read")
  getOne(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("productId") productId: string,
  ) {
    return this.products.getOne(sellerId, storeId, productId);
  }

  @Patch(":productId")
  @RequireStaffScope("catalog")
  update(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("productId") productId: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.products.update(sellerId, storeId, productId, dto);
  }

  @Delete(":productId")
  @RequireStaffScope("catalog")
  remove(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("productId") productId: string,
  ) {
    return this.products.remove(sellerId, storeId, productId);
  }
}
