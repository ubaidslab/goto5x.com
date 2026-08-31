import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { RequireStaffScope } from "../common/decorators/require-staff-scope.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { StaffScopeGuard } from "../common/guards/staff-scope.guard";
import { CustomersService } from "./customers.service";

/** SRS §5.52/FR-52.2 - every route here is read-only, so every route needs the same `customers` read grant. */
@Controller("stores/:storeId/customers")
@UseGuards(JwtAuthGuard, StaffScopeGuard)
@RequireStaffScope("customers", "read")
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  list(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Query("search") search?: string,
    @Query("sort") sort?: "total_spent" | "orders_count" | "last_order_at",
  ) {
    return this.customers.list(sellerId, storeId, { search, sort });
  }

  @Get(":customerId")
  getOne(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("customerId") customerId: string,
  ) {
    return this.customers.getOne(sellerId, storeId, customerId);
  }
}
