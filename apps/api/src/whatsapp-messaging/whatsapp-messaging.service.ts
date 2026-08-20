import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { OrderPricingService } from "../orders/order-pricing.service";
import { SubscriptionsService } from "../plans/subscriptions.service";
import { SettingsService } from "../settings-registry/settings.service";
import { StorefrontService } from "../storefront/storefront.service";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { buildWhatsAppDeepLink, interpolateWhatsAppTemplate } from "./whatsapp-link.util";

const ORDER_CONFIRMED_OR_BEYOND = ["confirmed", "shipped", "delivered", "completed"];
const ORDER_SHIPPED_OR_BEYOND = ["shipped", "delivered", "completed"];

/**
 * SRS §5.41/FR-41.1 (Module 30) - three seller-clicked WhatsApp deep-link
 * generators, reusing the exact `wa.me` construction the WhatsApp OTP
 * Adapter (Module 26) already established and the tracking/abandoned-cart
 * machinery Modules 8/9/15.2 already built. Nothing here sends a message
 * itself; every method returns a link the seller taps to send from their
 * own connected WhatsApp app (FR-41.4's deferred Business API automation is
 * the only thing that would ever send on the platform's behalf).
 */
@Injectable()
export class WhatsAppMessagingService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly settings: SettingsService,
    private readonly storefront: StorefrontService,
    private readonly pricing: OrderPricingService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  private orderNumber(orderId: string): string {
    return orderId.slice(0, 8).toUpperCase();
  }

  /** FR-41.1a - available once an order is confirmed (or any status beyond). */
  async generateOrderConfirmationLink(sellerId: string, storeId: string, orderId: string) {
    const { order, store } = await this.tenantPrisma.run(sellerId, async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order || order.storeId !== storeId) throw new NotFoundException("Order not found.");
      const store = await tx.store.findUniqueOrThrow({ where: { id: storeId } });
      return { order, store };
    });
    if (!ORDER_CONFIRMED_OR_BEYOND.includes(order.status)) {
      throw new BadRequestException("This order isn't confirmed yet.");
    }
    if (!order.buyerWhatsapp) {
      throw new BadRequestException("No WhatsApp number was captured for this order.");
    }

    const template = await this.settings.resolve<string>("whatsapp.order_confirmation_template", { storeId });
    const message = interpolateWhatsAppTemplate(template, {
      order_number: this.orderNumber(order.id),
      store_name: store.name,
      total: Number(order.totalAmount).toFixed(2),
      currency: order.currency,
    });
    return { deepLink: buildWhatsAppDeepLink(order.buyerWhatsapp, message) };
  }

  /** FR-41.1b - available once tracking has been uploaded (FR-38.4's existing upload path, untouched by this module). */
  async generateShippingUpdateLink(sellerId: string, storeId: string, orderId: string) {
    const { order, store, latestTracking } = await this.tenantPrisma.run(sellerId, async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order || order.storeId !== storeId) throw new NotFoundException("Order not found.");
      const store = await tx.store.findUniqueOrThrow({ where: { id: storeId } });
      const items = await tx.orderItem.findMany({ where: { orderId } });
      const trackingUpdates = await tx.trackingUpdate.findMany({
        where: { orderItemId: { in: items.map((i) => i.id) } },
        orderBy: { uploadedAt: "desc" },
      });
      return { order, store, latestTracking: trackingUpdates[0] ?? null };
    });
    if (!ORDER_SHIPPED_OR_BEYOND.includes(order.status) || !latestTracking) {
      throw new BadRequestException("Tracking hasn't been uploaded for this order yet.");
    }
    if (!order.buyerWhatsapp) {
      throw new BadRequestException("No WhatsApp number was captured for this order.");
    }

    const template = await this.settings.resolve<string>("whatsapp.shipping_update_template", { storeId });
    const message = interpolateWhatsAppTemplate(template, {
      order_number: this.orderNumber(order.id),
      store_name: store.name,
      tracking_id: latestTracking.trackingId,
      carrier: latestTracking.carrier ?? "N/A",
    });
    return { deepLink: buildWhatsAppDeepLink(order.buyerWhatsapp, message) };
  }

  /** FR-41.1c - available once a cart is flagged abandoned (FR-15.2's existing sweep, untouched by this module). */
  async generateCartRecoveryLink(sellerId: string, storeId: string, cartId: string) {
    const { cart, store } = await this.tenantPrisma.run(sellerId, async (tx) => {
      const cart = await tx.cart.findUnique({ where: { id: cartId } });
      if (!cart || cart.storeId !== storeId) throw new NotFoundException("Cart not found.");
      const store = await tx.store.findUniqueOrThrow({ where: { id: storeId }, include: { domains: true } });
      return { cart, store };
    });
    if (cart.status !== "abandoned") {
      throw new BadRequestException("This cart isn't flagged abandoned yet.");
    }
    if (!cart.buyerWhatsapp) {
      throw new BadRequestException("No WhatsApp number was captured for this cart.");
    }

    const items = cart.items as { productId: string; variantId: string; quantity: number }[];
    const priced = items.length ? await this.pricing.priceItems(storeId, items) : [];
    const itemSummary = priced.length ? priced.map((i) => `${i.quantity}x ${i.title}`).join(", ") : "your items";
    const hostname = await this.storefront.canonicalHostnameFor(store);

    const template = await this.settings.resolve<string>("whatsapp.cart_recovery_template", { storeId });
    const message = interpolateWhatsAppTemplate(template, {
      item_summary: itemSummary,
      store_name: store.name,
      store_link: `https://${hostname}`,
    });
    return { deepLink: buildWhatsAppDeepLink(cart.buyerWhatsapp, message) };
  }

  /**
   * FR-55.4 (Module 48) - the fourth generator, and unlike the three above,
   * not tied to an existing Order/Cart row: reachable for any published
   * product at any time. No captured buyer WhatsApp number exists for this
   * trigger, so `buildWhatsAppDeepLink` gets `null` - the resulting link
   * opens WhatsApp's own share/contact picker rather than a pre-addressed
   * chat. Gated Growth+ (FR-55.2's mechanism, own key per FR-55.4's own note).
   */
  async generateProductShareLink(sellerId: string, storeId: string, productId: string) {
    const planContext = await this.subscriptions.getPlanContext(sellerId);
    const enabled = await this.settings.resolve<boolean>("whatsapp.product_share_enabled", planContext);
    if (!enabled) {
      throw new ForbiddenException("WhatsApp product sharing is a Growth-plan feature - upgrade your plan to use it.");
    }

    const { product, store } = await this.tenantPrisma.run(sellerId, async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        include: { variants: { take: 1, orderBy: { price: "asc" } } },
      });
      if (!product || product.storeId !== storeId) throw new NotFoundException("Product not found.");
      const store = await tx.store.findUniqueOrThrow({ where: { id: storeId }, include: { domains: true } });
      return { product, store };
    });
    if (product.status !== "active") {
      throw new BadRequestException("Only a published product can be shared.");
    }

    const hostname = await this.storefront.canonicalHostnameFor(store);
    const template = await this.settings.resolve<string>("whatsapp.product_share_template", { storeId });
    const message = interpolateWhatsAppTemplate(template, {
      product_title: product.title,
      price: Number(product.variants[0]?.price ?? 0).toFixed(2),
      currency: store.currency,
      store_name: store.name,
      product_link: `https://${hostname}/products/${product.id}`,
    });
    return { deepLink: buildWhatsAppDeepLink(null, message) };
  }

  /** Backs the seller-facing abandoned-cart list (FR-41.1c) - `hasWhatsapp` tells the UI which rows can actually generate a recovery link. */
  async listAbandonedCarts(sellerId: string, storeId: string) {
    const carts = await this.tenantPrisma.run(sellerId, async (tx) =>
      tx.cart.findMany({ where: { storeId, status: "abandoned" }, orderBy: { updatedAt: "desc" } }),
    );
    return Promise.all(
      carts.map(async (cart) => {
        const items = cart.items as { productId: string; variantId: string; quantity: number }[];
        const priced = items.length ? await this.pricing.priceItems(storeId, items) : [];
        return {
          id: cart.id,
          buyerEmail: cart.buyerEmail,
          hasWhatsapp: cart.buyerWhatsapp !== null,
          itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
          itemSummary: priced.length ? priced.map((i) => `${i.quantity}x ${i.title}`).join(", ") : "items",
          subtotal: priced.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
          updatedAt: cart.updatedAt,
        };
      }),
    );
  }
}
