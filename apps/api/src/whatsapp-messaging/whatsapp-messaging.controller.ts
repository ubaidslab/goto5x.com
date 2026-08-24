import { Body, Controller, Get, Param, Put, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { UpdateWhatsAppTemplateDto } from "./dto/update-whatsapp-template.dto";
import { WhatsAppMessagingService } from "./whatsapp-messaging.service";

@Controller("stores/:storeId/whatsapp")
@UseGuards(JwtAuthGuard)
export class WhatsAppMessagingController {
  constructor(private readonly whatsapp: WhatsAppMessagingService) {}

  /** Registered before ":cartId" routes so it isn't shadowed by that param route (same precedent as OrdersController's "overview"). */
  @Get("carts/abandoned")
  listAbandonedCarts(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    return this.whatsapp.listAbandonedCarts(sellerId, storeId);
  }

  /** Phase 4 close-out - the cart-recovery message template's own read/write, seller-editable per store. */
  @Get("settings/cart-recovery-template")
  getCartRecoveryTemplate(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    return this.whatsapp.getCartRecoveryTemplate(sellerId, storeId);
  }

  @Put("settings/cart-recovery-template")
  updateCartRecoveryTemplate(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Body() dto: UpdateWhatsAppTemplateDto,
  ) {
    return this.whatsapp.updateCartRecoveryTemplate(sellerId, storeId, dto.template);
  }

  @Get("orders/:orderId/confirmation-link")
  getOrderConfirmationLink(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("orderId") orderId: string,
  ) {
    return this.whatsapp.generateOrderConfirmationLink(sellerId, storeId, orderId);
  }

  @Get("orders/:orderId/shipping-update-link")
  getShippingUpdateLink(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("orderId") orderId: string,
  ) {
    return this.whatsapp.generateShippingUpdateLink(sellerId, storeId, orderId);
  }

  @Get("carts/:cartId/recovery-link")
  getCartRecoveryLink(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("cartId") cartId: string,
  ) {
    return this.whatsapp.generateCartRecoveryLink(sellerId, storeId, cartId);
  }

  /** FR-55.4 (Module 48) - the fourth generator, product-scoped rather than Order/Cart-scoped. */
  @Get("products/:productId/share-link")
  getProductShareLink(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("productId") productId: string,
  ) {
    return this.whatsapp.generateProductShareLink(sellerId, storeId, productId);
  }
}
