import { randomBytes } from "crypto";
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { OrderSource } from "@prisma/client";
import { RateLimitService } from "../common/rate-limit/rate-limit.service";
import { SettingsService } from "../settings-registry/settings.service";
import { CustomersService } from "../customers/customers.service";
import { GiftCardsService } from "../gift-cards/gift-cards.service";
import { InvoicePdfService } from "../invoices/invoice-pdf.service";
import { EmailService } from "../notifications/email.service";
import { OrderVerificationService } from "../order-verification/order-verification.service";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { DiscountCodesService } from "../store-settings/discount-codes.service";
import { hasAnyPaymentMethod } from "../store-settings/payment-instructions.service";
import { StorefrontService } from "../storefront/storefront.service";
import { SupplierListingsService } from "../suppliers/supplier-listings.service";
import { SellerIdentityService } from "../trust-safety/seller-identity.service";
import { CheckoutDto } from "./dto/checkout.dto";
import { CreateManualOrderDto } from "./dto/create-manual-order.dto";
import { round2 } from "./money.util";
import { OrderPricingService, PricedItem } from "./order-pricing.service";
import { computeOrderTotals } from "./order-totals.util";

interface ShippingAddressLike {
  fullName: string;
  line1: string;
  line2?: string;
  city: string;
  country: string;
  postalCode?: string;
  phone: string;
}

interface PlaceOrderParams {
  storeId: string;
  currency: string;
  buyerEmail: string;
  buyerWhatsapp: string | null;
  items: { productId: string; variantId: string; quantity: number }[];
  shippingAddress: ShippingAddressLike;
  discountCode?: string;
  giftCardCode?: string;
  source: OrderSource;
}

/**
 * The one place an Order/OrderItem row is ever created - both the buyer-
 * facing storefront checkout and the seller's dashboard manual-order
 * creation (FR-17.1) go through placeOrder() so the two never drift into
 * producing differently-shaped rows. Financial Truth Invariant (§3.12):
 * every order this creates is `status: 'pending'` - nothing here ever
 * writes `confirmed` (that only happens in OrdersService.markAsPaid()).
 */
@Injectable()
export class CheckoutService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly storefront: StorefrontService,
    private readonly pricing: OrderPricingService,
    private readonly supplierListings: SupplierListingsService,
    private readonly discountCodes: DiscountCodesService,
    private readonly giftCards: GiftCardsService,
    private readonly email: EmailService,
    private readonly sellerIdentity: SellerIdentityService,
    private readonly customers: CustomersService,
    private readonly invoicePdf: InvoicePdfService,
    private readonly orderVerification: OrderVerificationService,
    private readonly rateLimit: RateLimitService,
    private readonly settings: SettingsService,
  ) {}

  async checkout(dto: CheckoutDto, ip: string) {
    // Phase B pre-launch audit finding - public, unauthenticated; creates a
    // real order (decrements stock, sends email, renders a PDF invoice) and
    // is the entry point for gift-card/discount-code guessing. Was the
    // highest-severity gap found in the rate-limit re-audit.
    const checkoutLimit = await this.settings.resolve<number>("orders.checkout_rate_limit_per_hour");
    await this.rateLimit.enforcePerHour(`checkout-ip:${ip}`, checkoutLimit);

    const store = await this.storefront.loadActiveStoreOrThrow(dto.hostname);
    const cart = await this.prismaAdmin.cart.findUnique({ where: { sessionToken: dto.sessionToken } });
    if (!cart || cart.storeId !== store.id) throw new NotFoundException("Cart not found.");
    if (cart.status !== "active") throw new BadRequestException("This cart is no longer active.");

    const items = cart.items as { productId: string; variantId: string; quantity: number }[];
    if (items.length === 0) throw new BadRequestException("This cart is empty.");

    const { order, paymentInstructions } = await this.placeOrder({
      storeId: store.id,
      currency: store.currency,
      buyerEmail: cart.buyerEmail,
      buyerWhatsapp: dto.buyerWhatsapp ?? null,
      items,
      shippingAddress: dto.shippingAddress,
      discountCode: dto.discountCode,
      giftCardCode: dto.giftCardCode,
      source: "storefront",
    });

    await this.prismaAdmin.cart.update({
      where: { id: cart.id },
      data: { status: "converted", convertedOrderId: order.id },
    });

    const canonicalHostname = await this.storefront.canonicalHostnameFor(store);
    await this.email.sendOrderConfirmationEmail(
      order.buyerEmail,
      store.name,
      `https://${canonicalHostname}/order-status/${order.statusLookupToken}`,
      paymentInstructions,
      order.invoicePdfUrl,
    );

    return order;
  }

  /** FR-17.1 - dashboard-created order, identical shape to a storefront one; `source: 'manual'` is the only difference. */
  async createManualOrder(sellerId: string, storeId: string, dto: CreateManualOrderDto) {
    await this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");
    });
    const store = await this.prismaAdmin.store.findUniqueOrThrow({
      where: { id: storeId },
      include: { domains: true },
    });

    const { order, paymentInstructions } = await this.placeOrder({
      storeId: store.id,
      currency: store.currency,
      buyerEmail: dto.buyerEmail,
      buyerWhatsapp: dto.buyerWhatsapp ?? null,
      items: dto.items,
      shippingAddress: dto.shippingAddress,
      discountCode: dto.discountCode,
      giftCardCode: dto.giftCardCode,
      source: "manual",
    });

    const canonicalHostname = await this.storefront.canonicalHostnameFor(store);
    await this.email.sendOrderConfirmationEmail(
      order.buyerEmail,
      store.name,
      `https://${canonicalHostname}/order-status/${order.statusLookupToken}`,
      paymentInstructions,
      order.invoicePdfUrl,
    );

    return order;
  }

  private async placeOrder(params: PlaceOrderParams) {
    const priced = await this.pricing.priceItems(params.storeId, params.items);

    // FR-4.7 - hard stop, checked before any stock is touched or discount consumed.
    for (const item of priced) {
      if (item.supportedCountries && !item.supportedCountries.includes(params.shippingAddress.country)) {
        throw new BadRequestException(`"${item.title}" cannot be shipped to ${params.shippingAddress.country}.`);
      }
    }

    const reserved = await this.reserveSupplierStock(priced);
    const reservedVariants = await this.reserveSelfFulfilledStock(priced, reserved);
    // Declared outside the try block (unlike discountAmount/discountCodeId
    // below) so the catch handler can release a reservation that outlived
    // the order it was meant for - see the release call in catch.
    let giftCardReservation: { giftCardId: string; amount: number } | null = null;

    try {
      const subtotalBeforeDiscount = round2(priced.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0));

      let discountAmount = 0;
      let discountCodeId: string | null = null;
      if (params.discountCode) {
        const applied = await this.discountCodes.validateAndApply(
          params.storeId,
          params.discountCode,
          subtotalBeforeDiscount,
        );
        discountAmount = applied.amount;
        discountCodeId = applied.discountCodeId;
      }

      const [shippingSettings, taxSettings, paymentInstructions, store] = await Promise.all([
        this.prismaAdmin.storeShippingSettings.findUniqueOrThrow({ where: { storeId: params.storeId } }),
        this.prismaAdmin.storeTaxSettings.findUniqueOrThrow({ where: { storeId: params.storeId } }),
        this.prismaAdmin.storePaymentInstructions.findUniqueOrThrow({ where: { storeId: params.storeId } }),
        this.prismaAdmin.store.findUniqueOrThrow({
          where: { id: params.storeId },
          select: { sellerId: true, name: true, status: true, publishedAt: true, logoMedia: { select: { url: true } } },
        }),
      ]);

      // Module 20 (SRS §5.6e, FR-6.21) - v1.0 now HAS a real publish gate
      // (StorePublishController.publish(), a seller-clicked action checking
      // payment method + CNIC + minimum wallet top-up together). The two
      // checks below are kept anyway as defense-in-depth: payment
      // instructions/CNIC can both be edited after publishing, so a
      // published store could theoretically drift out of readiness later.
      if (!hasAnyPaymentMethod(paymentInstructions)) {
        throw new BadRequestException(
          "This store hasn't configured a way to receive payment yet - checkout isn't available.",
        );
      }

      // SRS §5.30/FR-30.1 - "same activation gate as FR-6.14's payment-
      // instruction requirement": a store cannot go live (take an order)
      // without a valid CNIC on file for the seller behind it.
      if (!(await this.sellerIdentity.hasCnic(store.sellerId))) {
        throw new BadRequestException(
          "This store's seller hasn't completed identity verification yet - checkout isn't available.",
        );
      }

      // FR-6.21 - the actual publish gate: no order can complete before a
      // seller has explicitly published this store.
      if (!store.publishedAt) {
        throw new BadRequestException("This store hasn't been published yet - checkout isn't available.");
      }

      // FR-6.25 - the low-balance grace ladder's enforcement point:
      // storefront browsing stayed open (StorefrontService), only checkout
      // itself is blocked, with a respectful message rather than a hard error page.
      if (store.status === "orders_paused") {
        throw new BadRequestException(
          "This store is temporarily not accepting orders. Please check back soon.",
        );
      }

      // Module 26 (SRS §5.37/FR-37.1) - same "store readiness" gate as the
      // three checks above: a store whose Email OTP channel has no
      // connected sender must not accept a checkout it can never verify.
      await this.orderVerification.assertChannelReady(store.sellerId, params.storeId);

      const { shippingAmount, taxAmount, totalAmount } = computeOrderTotals({
        items: priced.map((i) => ({
          unitPrice: i.unitPrice,
          quantity: i.quantity,
          lineShippingCost: i.supplierListingId ? round2(i.shippingCost * i.quantity) : 0,
          isSupplierItem: Boolean(i.supplierListingId),
        })),
        discountAmount,
        shippingFlatRate: Number(shippingSettings.flatRate),
        shippingFreeThreshold:
          shippingSettings.freeShippingThreshold !== null ? Number(shippingSettings.freeShippingThreshold) : null,
        taxRate: Number(taxSettings.taxRate),
        taxInclusive: taxSettings.taxInclusive,
      });

      // FR-49.5/49.6 - a payment reduction against the already-computed
      // total, never a price discount (unlike discountAmount above, it
      // plays no part in computeOrderTotals()'s tax/shipping math).
      // Reserved here (same pre-transaction timing as the discount code
      // above) so the redemption row itself can reference the order id
      // once it exists, inside the transaction below; released in the
      // catch block if order creation fails for any other reason, same
      // discipline as releaseSupplierStock.
      if (params.giftCardCode) {
        giftCardReservation = await this.giftCards.validateAndReserve(params.storeId, params.giftCardCode, totalAmount);
      }
      const giftCardAmount = giftCardReservation?.amount ?? 0;

      const order = await this.prismaAdmin.$transaction(async (tx) => {
        // FR-13.1 - applies uniformly regardless of order source (storefront
        // or manual/FR-17.1): the same customer record is created/matched
        // before the order it belongs to even exists.
        const customer = await this.customers.findOrCreateForOrder(
          tx,
          params.storeId,
          params.buyerEmail,
          params.shippingAddress.fullName,
          params.shippingAddress.phone,
        );

        const created = await tx.order.create({
          data: {
            storeId: params.storeId,
            customerId: customer.id,
            buyerEmail: params.buyerEmail,
            buyerWhatsapp: params.buyerWhatsapp,
            statusLookupToken: randomBytes(24).toString("hex"),
            shippingAddress: params.shippingAddress as unknown as object,
            status: "pending",
            source: params.source,
            discountCodeId,
            discountAmount,
            giftCardAmount,
            shippingAmount,
            taxAmount,
            totalAmount,
            currency: params.currency,
            items: {
              create: priced.map((item) => ({
                storeId: params.storeId,
                productId: item.productId,
                variantId: item.variantId,
                supplierId: item.supplierId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                shippingCost: item.supplierListingId ? round2(item.shippingCost * item.quantity) : 0,
              })),
            },
          },
          include: { items: true },
        });

        // FR-49.4 - the append-only redemption ledger row, created only
        // once the order it belongs to actually exists.
        if (giftCardReservation) {
          await this.giftCards.recordRedemption(tx, params.storeId, giftCardReservation.giftCardId, created.id, giftCardReservation.amount);
        }

        await tx.orderTimelineEvent.create({
          data: {
            storeId: params.storeId,
            orderId: created.id,
            eventType: "order_created",
            afterValue: { status: "pending", totalAmount, source: params.source },
          },
        });

        return created;
      });
      // Once the transaction above commits, the redemption row is real and
      // permanent - anything that fails from here on (invoice PDF, etc.)
      // must never trigger a release of a reservation that no longer
      // exists as a "reservation" at all, only as a committed redemption.
      giftCardReservation = null;

      // Module 26 (SRS §5.37/FR-37.1) - creates the pending OrderVerification
      // row (the Financial Truth Invariant gate OrdersService.markAsPaid()
      // checks) and sends the first OTP, if this store has a channel
      // configured. A no-op when the store's channel is "none".
      await this.orderVerification.createForOrder({
        storeId: params.storeId,
        sellerId: store.sellerId,
        orderId: order.id,
        storeName: store.name,
        buyerEmail: params.buyerEmail,
        buyerWhatsapp: params.buyerWhatsapp,
      });

      // FR-19.1 - rendered once, right after the order that owns it exists,
      // the same moment the order-confirmation email already sends. Never
      // inside the transaction above: PDF rendering is slow I/O, not a
      // bookkeeping write that belongs inside the atomic order-creation step.
      const invoicePdfUrl = await this.invoicePdf.generate({
        orderId: order.id,
        storeId: params.storeId,
        storeName: store.name,
        logoUrl: store.logoMedia?.url ?? null,
        currency: params.currency,
        placedAt: order.placedAt,
        buyerName: params.shippingAddress.fullName,
        buyerEmail: params.buyerEmail,
        items: priced.map((item) => ({ title: item.title, quantity: item.quantity, unitPrice: item.unitPrice })),
        subtotal: subtotalBeforeDiscount,
        discountAmount,
        shippingAmount,
        taxAmount,
        taxLabel: taxSettings.taxLabel,
        taxInclusive: taxSettings.taxInclusive,
        totalAmount,
      });
      if (invoicePdfUrl) {
        await this.prismaAdmin.order.update({ where: { id: order.id }, data: { invoicePdfUrl } });
      }

      return { order: { ...order, invoicePdfUrl }, paymentInstructions };
    } catch (err) {
      // A rejected order (invalid/expired discount, DB error) must never
      // leave supplier stock decremented - or a self-fulfilled variant's
      // stock decremented, or a gift card balance debited - for an order
      // that was never created.
      await this.releaseSupplierStock(reserved);
      await this.releaseSelfFulfilledStock(reservedVariants);
      if (giftCardReservation) {
        await this.giftCards.releaseReservation(giftCardReservation.giftCardId, giftCardReservation.amount);
      }
      throw err;
    }
  }

  /**
   * FR-4.5 - atomic per-row decrement; any single failed decrement reverts
   * every reservation this same request already made, so a rejected
   * checkout never leaves phantom stock missing.
   */
  private async reserveSupplierStock(
    priced: PricedItem[],
  ): Promise<{ supplierListingId: string; quantity: number }[]> {
    const reserved: { supplierListingId: string; quantity: number }[] = [];
    for (const item of priced) {
      if (!item.supplierListingId) continue;
      const ok = await this.supplierListings.decrementStock(item.supplierListingId, item.quantity);
      if (!ok) {
        await this.releaseSupplierStock(reserved);
        throw new ConflictException(`"${item.title}" no longer has enough stock available.`);
      }
      reserved.push({ supplierListingId: item.supplierListingId, quantity: item.quantity });
    }
    return reserved;
  }

  private async releaseSupplierStock(reserved: { supplierListingId: string; quantity: number }[]): Promise<void> {
    for (const r of reserved) {
      await this.supplierListings.incrementStock(r.supplierListingId, r.quantity);
    }
  }

  /**
   * Module 46 (SRS §5.39, FR-39.5 corrected) - the same atomic
   * conditional-decrement pattern as reserveSupplierStock(), applied to
   * ProductVariant.stockQuantity for self-fulfilled items
   * (`item.trackInventory === true`; a supplier-fulfilled item's
   * trackInventory is null and is skipped here since reserveSupplierStock()
   * already reserved it against the supplier listing's own stock, and
   * `trackInventory === false` means the seller has opted this variant out
   * of oversell protection entirely). On its own failure, also releases the
   * supplier reservation this same request already made, since that
   * succeeded before this method ran.
   */
  private async reserveSelfFulfilledStock(
    priced: PricedItem[],
    supplierReserved: { supplierListingId: string; quantity: number }[],
  ): Promise<{ variantId: string; quantity: number }[]> {
    const reserved: { variantId: string; quantity: number }[] = [];
    for (const item of priced) {
      if (item.trackInventory !== true) continue;
      const result = await this.prismaAdmin.productVariant.updateMany({
        where: { id: item.variantId, stockQuantity: { gte: item.quantity } },
        data: { stockQuantity: { decrement: item.quantity } },
      });
      if (result.count === 0) {
        await this.releaseSelfFulfilledStock(reserved);
        await this.releaseSupplierStock(supplierReserved);
        throw new ConflictException(`"${item.title}" no longer has enough stock available.`);
      }
      reserved.push({ variantId: item.variantId, quantity: item.quantity });
    }
    return reserved;
  }

  private async releaseSelfFulfilledStock(reserved: { variantId: string; quantity: number }[]): Promise<void> {
    for (const r of reserved) {
      await this.prismaAdmin.productVariant.update({
        where: { id: r.variantId },
        data: { stockQuantity: { increment: r.quantity } },
      });
    }
  }
}
