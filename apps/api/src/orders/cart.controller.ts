import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { Request } from "express";
import { CartService } from "./cart.service";
import { CreateCartDto } from "./dto/create-cart.dto";
import { ShippingQuoteDto } from "./dto/shipping-quote.dto";
import { UpdateCartDto } from "./dto/update-cart.dto";

/**
 * Public, unauthenticated - same "hostname passed explicitly" reasoning as
 * StorefrontController (the API's own hostname differs from a store's
 * storefront hostname in production).
 */
@Controller("storefront/cart")
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Post()
  create(@Body() dto: CreateCartDto, @Req() req: Request) {
    return this.cart.create(dto, req.ip ?? "unknown");
  }

  @Get(":sessionToken")
  get(@Param("sessionToken") sessionToken: string, @Query("hostname") hostname: string) {
    return this.cart.get(hostname, sessionToken);
  }

  @Patch(":sessionToken")
  update(@Param("sessionToken") sessionToken: string, @Body() dto: UpdateCartDto) {
    return this.cart.update(dto.hostname, sessionToken, dto);
  }

  @Post("shipping-quote")
  quoteShipping(@Body() dto: ShippingQuoteDto) {
    return this.cart.quoteShipping(dto);
  }
}
