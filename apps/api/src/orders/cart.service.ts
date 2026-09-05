import { randomBytes } from "crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { RateLimitService } from "../common/rate-limit/rate-limit.service";
import { SettingsService } from "../settings-registry/settings.service";
import { StorefrontService } from "../storefront/storefront.service";
import { CreateCartDto } from "./dto/create-cart.dto";
import { ShippingQuoteDto } from "./dto/shipping-quote.dto";
import { UpdateCartDto } from "./dto/update-cart.dto";
import { round2 } from "./money.util";
import { OrderPricingService } from "./order-pricing.service";
import { computeOrderTotals } from "./order-totals.util";

/**
 * FR-15.1 (locked UX decision) - a `carts` row is only ever created once
 * the email-first step completes; there is no anonymous/pre-email cart row
 * server-side. Public/pre-auth, same BYPASSRLS reasoning as
 * StorefrontService (which this reuses for hostname -> store resolution and
 * the suspended-store gate, FR-5.3).
 */
@Injectable()
export class CartService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly storefront: StorefrontService,
    private readonly pricing: OrderPricingService,
    private readonly settings: SettingsService,
    private readonly rateLimit: RateLimitService,
  ) {}

  async create(dto: CreateCartDto, ip: string) {
    // Phase B pre-launch audit finding - public, unauthenticated cart-row creation.
    const cartLimit = await this.settings.resolve<number>("orders.cart_create_rate_limit_per_hour");
    await this.rateLimit.enforcePerHour(`cart-create-ip:${ip}`, cartLimit);

    const store = await this.storefront.loadActiveStoreOrThrow(dto.hostname);
    // Validates every item resolves to a real product/variant in this store
    // before a cart row is ever written - same fail-fast reasoning as
    // checkout's own pricing step.
    await this.pricing.priceItems(store.id, dto.items);

    const cart = await this.prismaAdmin.cart.create({
      data: {
        storeId: store.id,
        buyerEmail: dto.buyerEmail,
        buyerWhatsapp: dto.buyerWhatsapp ?? null,
        sessionToken: randomBytes(32).toString("hex"),
        items: dto.items as unknown as object,
      },
    });
    return this.toPublicCart(cart, store.id);
  }

  async update(hostname: string, sessionToken: string, dto: UpdateCartDto) {
    const store = await this.storefront.loadActiveStoreOrThrow(hostname);
    const cart = await this.findActiveOrThrow(store.id, sessionToken);
    await this.pricing.priceItems(store.id, dto.items);

    const updated = await this.prismaAdmin.cart.update({
      where: { id: cart.id },
      // Module 91 (SRS §5.67/FR-67.2) - editing a deal cart's item list
      // forfeits the deal discount (dealId cleared unconditionally, cheap
      // even when it was already null): the uniform-percentage discount is
      // only valid for the deal's exact item set, and this is the only
      // place a buyer can change a deal cart's contents after buy-now
      // created it - closes the "pad in extra products to get them
      // discounted too" abuse vector without needing a subset check at
      // checkout time.
      data: { items: dto.items as unknown as object, dealId: null },
    });
    return this.toPublicCart(updated, store.id);
  }

  async get(hostname: string, sessionToken: string) {
    const store = await this.storefront.loadActiveStoreOrThrow(hostname);
    const cart = await this.findOrThrow(store.id, sessionToken);
    return this.toPublicCart(cart, store.id);
  }

  /**
   * FR-66.4 (Module 84) - surfaces shipping cost on product/cart pages,
   * reusing the exact same flat-rate/free-threshold math checkout performs
   * (CheckoutService.placeOrder(), see order-totals.util.ts) rather than a
   * static disclaimer. Public/pre-auth - a product-page quote runs before a
   * cart row even exists (single item, quantity 1), so this never touches
   * a stored cart.
   */
  async quoteShipping(dto: ShippingQuoteDto) {
    const store = await this.storefront.loadActiveStoreOrThrow(dto.hostname);
    const [priced, shippingSettings] = await Promise.all([
      this.pricing.priceItems(store.id, dto.items),
      this.prismaAdmin.storeShippingSettings.findUniqueOrThrow({ where: { storeId: store.id } }),
    ]);

    const shippingFreeThreshold = shippingSettings.freeShippingThreshold
      ? Number(shippingSettings.freeShippingThreshold)
      : null;
    const { subtotal, shippingAmount } = computeOrderTotals({
      items: priced.map((i) => ({
        unitPrice: i.unitPrice,
        quantity: i.quantity,
        lineShippingCost: i.supplierListingId ? round2(i.shippingCost * i.quantity) : 0,
        isSupplierItem: Boolean(i.supplierListingId),
      })),
      discountAmount: 0,
      shippingFlatRate: Number(shippingSettings.flatRate),
      shippingFreeThreshold,
      taxRate: 0,
      taxInclusive: false,
    });

    return {
      subtotal,
      shippingAmount,
      freeShippingThreshold: shippingFreeThreshold,
      amountUntilFreeShipping:
        shippingFreeThreshold !== null ? Math.max(0, round2(shippingFreeThreshold - subtotal)) : null,
    };
  }

  private async findOrThrow(storeId: string, sessionToken: string) {
    const cart = await this.prismaAdmin.cart.findUnique({ where: { sessionToken } });
    if (!cart || cart.storeId !== storeId) throw new NotFoundException("Cart not found.");
    return cart;
  }

  private async findActiveOrThrow(storeId: string, sessionToken: string) {
    const cart = await this.findOrThrow(storeId, sessionToken);
    if (cart.status !== "active") {
      throw new BadRequestException("This cart is no longer active.");
    }
    return cart;
  }

  private async toPublicCart(
    cart: { id: string; sessionToken: string; buyerEmail: string; status: string; items: unknown },
    storeId: string,
  ) {
    const items = cart.items as { productId: string; variantId: string; quantity: number }[];
    const priced = items.length ? await this.pricing.priceItems(storeId, items) : [];
    return {
      sessionToken: cart.sessionToken,
      buyerEmail: cart.buyerEmail,
      status: cart.status,
      items: priced,
      subtotal: priced.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
    };
  }

  /**
   * FR-15.2 - flags a captured-email cart `abandoned` once it has been
   * inactive beyond `cart.abandoned_after_hours` (Settings Registry). v1.0
   * ships this flagging mechanism only; recovery emails are v1.1 (§5.22,
   * FR-22.2) - so this never sends anything, just updates status.
   */
  async flagAbandonedCarts(): Promise<{ flagged: number }> {
    const hours = await this.settings.resolve<number>("cart.abandoned_after_hours");
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const result = await this.prismaAdmin.cart.updateMany({
      where: { status: "active", updatedAt: { lt: cutoff } },
      data: { status: "abandoned" },
    });
    return { flagged: result.count };
  }
}
