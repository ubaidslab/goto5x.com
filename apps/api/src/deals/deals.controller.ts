import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { DealsService } from "./deals.service";
import { CreateDealDto } from "./dto/create-deal.dto";
import { DealItemInputDto } from "./dto/deal-item-input.dto";
import { UpdateDealDto } from "./dto/update-deal.dto";

/** SRS §5.67/FR-67.4 - seller dashboard Deals management (under the Products hub). */
@Controller("stores/:storeId/deals")
@UseGuards(JwtAuthGuard)
export class DealsController {
  constructor(private readonly deals: DealsService) {}

  @Post()
  create(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Body() dto: CreateDealDto) {
    return this.deals.create(sellerId, storeId, dto);
  }

  @Get()
  list(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    return this.deals.list(sellerId, storeId);
  }

  @Get(":dealId")
  getOne(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Param("dealId") dealId: string) {
    return this.deals.getOne(sellerId, storeId, dealId);
  }

  @Patch(":dealId")
  update(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("dealId") dealId: string,
    @Body() dto: UpdateDealDto,
  ) {
    return this.deals.update(sellerId, storeId, dealId, dto);
  }

  @Delete(":dealId")
  remove(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Param("dealId") dealId: string) {
    return this.deals.remove(sellerId, storeId, dealId);
  }

  @Post(":dealId/items")
  addItem(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("dealId") dealId: string,
    @Body() dto: DealItemInputDto,
  ) {
    return this.deals.addItem(sellerId, storeId, dealId, dto);
  }

  @Delete(":dealId/items/:dealItemId")
  removeItem(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("dealId") dealId: string,
    @Param("dealItemId") dealItemId: string,
  ) {
    return this.deals.removeItem(sellerId, storeId, dealId, dealItemId);
  }
}
