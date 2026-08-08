import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CreateProductDto } from "./dto/create-product.dto";
import { ProductListQueryDto } from "./dto/product-list-query.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { ProductsService } from "./products.service";

@Controller("stores/:storeId/products")
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Post()
  create(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Body() dto: CreateProductDto) {
    return this.products.create(sellerId, storeId, dto);
  }

  @Get()
  list(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Query() query: ProductListQueryDto) {
    return this.products.list(sellerId, storeId, query);
  }

  @Get(":productId")
  getOne(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("productId") productId: string,
  ) {
    return this.products.getOne(sellerId, storeId, productId);
  }

  @Patch(":productId")
  update(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("productId") productId: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.products.update(sellerId, storeId, productId, dto);
  }

  @Delete(":productId")
  remove(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("productId") productId: string,
  ) {
    return this.products.remove(sellerId, storeId, productId);
  }
}
