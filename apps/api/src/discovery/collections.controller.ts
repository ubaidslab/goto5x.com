import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AddCollectionProductDto } from "./dto/add-collection-product.dto";
import { CreateCollectionDto } from "./dto/create-collection.dto";
import { ReorderCollectionProductDto } from "./dto/reorder-collection-product.dto";
import { UpdateCollectionDto } from "./dto/update-collection.dto";
import { CollectionsService } from "./collections.service";

@Controller("stores/:storeId/collections")
@UseGuards(JwtAuthGuard)
export class CollectionsController {
  constructor(private readonly collections: CollectionsService) {}

  @Post()
  create(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Body() dto: CreateCollectionDto) {
    return this.collections.create(sellerId, storeId, dto);
  }

  @Get()
  list(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    return this.collections.list(sellerId, storeId);
  }

  @Get(":collectionId")
  getOne(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("collectionId") collectionId: string,
  ) {
    return this.collections.getOne(sellerId, storeId, collectionId);
  }

  @Patch(":collectionId")
  update(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("collectionId") collectionId: string,
    @Body() dto: UpdateCollectionDto,
  ) {
    return this.collections.update(sellerId, storeId, collectionId, dto);
  }

  @Delete(":collectionId")
  remove(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("collectionId") collectionId: string,
  ) {
    return this.collections.remove(sellerId, storeId, collectionId);
  }

  @Post(":collectionId/products")
  addProduct(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("collectionId") collectionId: string,
    @Body() dto: AddCollectionProductDto,
  ) {
    return this.collections.addProduct(sellerId, storeId, collectionId, dto);
  }

  @Patch(":collectionId/products/:productId")
  reorderProduct(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("collectionId") collectionId: string,
    @Param("productId") productId: string,
    @Body() dto: ReorderCollectionProductDto,
  ) {
    return this.collections.reorderProduct(sellerId, storeId, collectionId, productId, dto.sortOrder);
  }

  @Delete(":collectionId/products/:productId")
  removeProduct(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("collectionId") collectionId: string,
    @Param("productId") productId: string,
  ) {
    return this.collections.removeProduct(sellerId, storeId, collectionId, productId);
  }
}
