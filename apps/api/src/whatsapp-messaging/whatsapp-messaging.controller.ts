import { Body, Controller, Get, Param, Put, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { RequireStaffScope } from "../common/decorators/require-staff-scope.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { StaffScopeGuard } from "../common/guards/staff-scope.guard";
import { UpdateWhatsAppTemplateDto } from "./dto/update-whatsapp-template.dto";
import { WhatsAppMessagingService } from "./whatsapp-messaging.service";

/** SRS §5.52/FR-52.7-52.8 (Module 97) - a staff session needs the `marketing` scope. */
@Controller("stores/:storeId/whatsapp")
@UseGuards(JwtAuthGuard, StaffScopeGuard)
export class WhatsAppMessagingController {
  constructor(private readonly whatsapp: WhatsAppMessagingService) {}

  /** Registered before ":cartId" routes so it isn't shadowed by that param route (same precedent as OrdersController's "overview"). */
  @Get("carts/abandoned")
  @RequireStaffScope("marketing", "read")
  listAbandonedCarts(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    return this.whatsapp.listAbandonedCarts(sellerId, storeId);
  }

  /** Phase 4 close-out - the cart-recovery message template's own read/write, seller-editable per store. */
  @Get("settings/cart-recovery-template")
  @RequireStaffScope("marketing", "read")
  getCartRecoveryTemplate(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    return this.whatsapp.getCartRecoveryTemplate(sellerId, storeId);
  }

  @Put("settings/cart-recovery-template")
  @RequireStaffScope("marketing")
  updateCartRecoveryTemplate(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Body() dto: UpdateWhatsAppTemplateDto,
  ) {
    return this.whatsapp.updateCartRecoveryTemplate(sellerId, storeId, dto.template);
  }

  @Get("orders/:orderId/confirmation-link")
  @RequireStaffScope("marketing", "read")
  getOrderConfirmationLink(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("orderId") orderId: string,
  ) {
    return this.whatsapp.generateOrderConfirmationLink(sellerId, storeId, orderId);
  }

  @Get("orders/:orderId/shipping-update-link")
  @RequireStaffScope("marketing", "read")
  getShippingUpdateLink(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("orderId") orderId: string,
  ) {
    return this.whatsapp.generateShippingUpdateLink(sellerId, storeId, orderId);
  }

  @Get("carts/:cartId/recovery-link")
  @RequireStaffScope("marketing", "read")
  getCartRecoveryLink(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("cartId") cartId: string,
  ) {
    return this.whatsapp.generateCartRecoveryLink(sellerId, storeId, cartId);
  }

  /** FR-55.4 (Module 48) - the fourth generator, product-scoped rather than Order/Cart-scoped. */
  @Get("products/:productId/share-link")
  @RequireStaffScope("marketing", "read")
  getProductShareLink(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("productId") productId: string,
  ) {
    return this.whatsapp.generateProductShareLink(sellerId, storeId, productId);
  }
}
