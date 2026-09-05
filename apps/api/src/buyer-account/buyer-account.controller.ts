import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { BuyerAuthGuard } from "../common/guards/buyer-auth.guard";
import { CurrentBuyer } from "../common/decorators/current-buyer.decorator";
import { BuyerAccountService } from "./buyer-account.service";
import { BuyerAddressDto } from "./dto/buyer-address.dto";
import { WishlistItemDto } from "./dto/wishlist-item.dto";

/** FR-66.1 (Module 81) - buyer-facing profile/saved-address/order-history reads and writes, all behind BuyerAuthGuard. */
@Controller("storefront/account")
@UseGuards(BuyerAuthGuard)
export class BuyerAccountController {
  constructor(private readonly buyerAccount: BuyerAccountService) {}

  @Get("me")
  getProfile(@CurrentBuyer() buyer: { buyerId: string }) {
    return this.buyerAccount.getProfile(buyer.buyerId);
  }

  @Patch("me")
  updateProfile(@CurrentBuyer() buyer: { buyerId: string }, @Body() body: { displayName?: string }) {
    return this.buyerAccount.updateProfile(buyer.buyerId, body.displayName);
  }

  @Get("addresses")
  listAddresses(@CurrentBuyer() buyer: { buyerId: string }) {
    return this.buyerAccount.listAddresses(buyer.buyerId);
  }

  @Post("addresses")
  createAddress(@CurrentBuyer() buyer: { buyerId: string }, @Body() dto: BuyerAddressDto) {
    return this.buyerAccount.createAddress(buyer.buyerId, dto);
  }

  @Patch("addresses/:addressId")
  updateAddress(
    @CurrentBuyer() buyer: { buyerId: string },
    @Param("addressId") addressId: string,
    @Body() dto: BuyerAddressDto,
  ) {
    return this.buyerAccount.updateAddress(buyer.buyerId, addressId, dto);
  }

  @Delete("addresses/:addressId")
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteAddress(@CurrentBuyer() buyer: { buyerId: string }, @Param("addressId") addressId: string) {
    return this.buyerAccount.deleteAddress(buyer.buyerId, addressId);
  }

  @Get("orders")
  listOrders(@CurrentBuyer() buyer: { userId: string }, @Query("storeId") storeId?: string) {
    return this.buyerAccount.listOrders(buyer.userId, storeId);
  }

  @Get("wishlist")
  listWishlist(@CurrentBuyer() buyer: { buyerId: string }) {
    return this.buyerAccount.listWishlist(buyer.buyerId);
  }

  @Get("wishlist/:productId")
  isWishlisted(@CurrentBuyer() buyer: { buyerId: string }, @Param("productId") productId: string) {
    return this.buyerAccount.isWishlisted(buyer.buyerId, productId);
  }

  @Post("wishlist")
  addWishlistItem(@CurrentBuyer() buyer: { buyerId: string }, @Body() dto: WishlistItemDto) {
    return this.buyerAccount.addWishlistItem(buyer.buyerId, dto.productId);
  }

  @Delete("wishlist/:productId")
  @HttpCode(HttpStatus.NO_CONTENT)
  removeWishlistItem(@CurrentBuyer() buyer: { buyerId: string }, @Param("productId") productId: string) {
    return this.buyerAccount.removeWishlistItem(buyer.buyerId, productId);
  }
}
