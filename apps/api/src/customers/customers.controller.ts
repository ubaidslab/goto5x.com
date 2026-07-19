import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CustomersService } from "./customers.service";

@Controller("stores/:storeId/customers")
@UseGuards(JwtAuthGuard)
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
