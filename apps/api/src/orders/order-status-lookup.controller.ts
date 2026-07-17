import { Controller, Get, Param } from "@nestjs/common";
import { OrderStatusLookupService } from "./order-status-lookup.service";

/** FR-5.4 - public, unauthenticated; `token` is the unguessable lookup key, never a sequential order id. */
@Controller("storefront/order-status")
export class OrderStatusLookupController {
  constructor(private readonly lookup: OrderStatusLookupService) {}

  @Get(":token")
  get(@Param("token") token: string) {
    return this.lookup.lookup(token);
  }
}
