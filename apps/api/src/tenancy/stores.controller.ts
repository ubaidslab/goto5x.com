import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { CreateStoreDto } from "./dto/create-store.dto";
import { UpdateStoreDto } from "./dto/update-store.dto";
import { StoresService } from "./stores.service";

@Controller("stores")
@UseGuards(JwtAuthGuard)
export class StoresController {
  constructor(private readonly stores: StoresService) {}

  @Post()
  create(@CurrentSellerId() sellerId: string, @Body() dto: CreateStoreDto) {
    return this.stores.create(sellerId, dto);
  }

  @Get()
  listOwn(@CurrentSellerId() sellerId: string) {
    return this.stores.listOwn(sellerId);
  }

  @Get(":id")
  getOwn(@CurrentSellerId() sellerId: string, @Param("id") id: string) {
    return this.stores.getOwn(sellerId, id);
  }

  @Patch(":id")
  updateOwn(@CurrentSellerId() sellerId: string, @Param("id") id: string, @Body() dto: UpdateStoreDto) {
    return this.stores.updateOwn(sellerId, id, dto);
  }
}
