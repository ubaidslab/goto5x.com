import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireStaffScope } from "../common/decorators/require-staff-scope.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { StaffScopeGuard } from "../common/guards/staff-scope.guard";
import { JwtAccessPayload } from "../common/types";
import { AdjustStockDto } from "./dto/adjust-stock.dto";
import { InventoryService } from "./inventory.service";

/**
 * SRS §5.39 - a dedicated stock screen, distinct from Products (FR-2.x), but
 * FR-2.1 groups "inventory tracking" under the same catalog concept, so it
 * shares the `catalog` staff scope (SRS §5.52/FR-52.2) rather than a scope
 * of its own.
 */
@Controller("stores/:storeId/inventory")
@UseGuards(JwtAuthGuard, StaffScopeGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  @RequireStaffScope("catalog", "read")
  list(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    return this.inventory.listInventory(sellerId, storeId);
  }

  @Post(":variantId/adjust")
  @RequireStaffScope("catalog")
  adjust(
    @CurrentSellerId() sellerId: string,
    @CurrentUser() user: JwtAccessPayload,
    @Param("storeId") storeId: string,
    @Param("variantId") variantId: string,
    @Body() dto: AdjustStockDto,
  ) {
    return this.inventory.adjustStock(sellerId, storeId, variantId, user.sub, dto);
  }

  @Get(":variantId/adjustments")
  @RequireStaffScope("catalog", "read")
  adjustments(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Param("variantId") variantId: string) {
    return this.inventory.listAdjustments(sellerId, storeId, variantId);
  }
}
