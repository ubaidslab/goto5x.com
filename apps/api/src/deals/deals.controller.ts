import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { RequireStaffScope } from "../common/decorators/require-staff-scope.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { StaffScopeGuard } from "../common/guards/staff-scope.guard";
import { DealsService } from "./deals.service";
import { CreateDealDto } from "./dto/create-deal.dto";
import { DealItemInputDto } from "./dto/deal-item-input.dto";
import { UpdateDealDto } from "./dto/update-deal.dto";

/** SRS §5.67/FR-67.4 - seller dashboard Deals management (under the Products hub). SRS §5.52/FR-52.7-52.8 (Module 97) - a staff session needs the `marketing` scope. */
@Controller("stores/:storeId/deals")
@UseGuards(JwtAuthGuard, StaffScopeGuard)
export class DealsController {
  constructor(private readonly deals: DealsService) {}

  @Post()
  @RequireStaffScope("marketing")
  create(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Body() dto: CreateDealDto) {
    return this.deals.create(sellerId, storeId, dto);
  }

  @Get()
  @RequireStaffScope("marketing", "read")
  list(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    return this.deals.list(sellerId, storeId);
  }

  @Get(":dealId")
  @RequireStaffScope("marketing", "read")
  getOne(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Param("dealId") dealId: string) {
    return this.deals.getOne(sellerId, storeId, dealId);
  }

  @Patch(":dealId")
  @RequireStaffScope("marketing")
  update(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("dealId") dealId: string,
    @Body() dto: UpdateDealDto,
  ) {
    return this.deals.update(sellerId, storeId, dealId, dto);
  }

  @Delete(":dealId")
  @RequireStaffScope("marketing")
  remove(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Param("dealId") dealId: string) {
    return this.deals.remove(sellerId, storeId, dealId);
  }

  @Post(":dealId/items")
  @RequireStaffScope("marketing")
  addItem(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("dealId") dealId: string,
    @Body() dto: DealItemInputDto,
  ) {
    return this.deals.addItem(sellerId, storeId, dealId, dto);
  }

  @Delete(":dealId/items/:dealItemId")
  @RequireStaffScope("marketing")
  removeItem(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("dealId") dealId: string,
    @Param("dealItemId") dealItemId: string,
  ) {
    return this.deals.removeItem(sellerId, storeId, dealId, dealItemId);
  }
}
