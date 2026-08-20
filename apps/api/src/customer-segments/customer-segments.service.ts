import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Customer, CustomerSegment, Prisma } from "@prisma/client";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { SettingsService } from "../settings-registry/settings.service";
import { SubscriptionsService } from "../plans/subscriptions.service";
import { CreateCustomerSegmentDto } from "./dto/create-customer-segment.dto";
import { PreviewCustomerSegmentDto } from "./dto/preview-customer-segment.dto";
import { UpdateCustomerSegmentDto } from "./dto/update-customer-segment.dto";
import { CustomerForMatching, LocationForMatching, matchesSegmentCriteria, SegmentCriteria } from "./customer-segment-matcher.util";

/**
 * SRS §5.50/FR-50.1-50.6. A `CustomerSegment` row is only ever a saved
 * filter (FR-50.1) - every method that returns "who's in this segment"
 * resolves membership live against Customer's existing ordersCount/
 * totalSpent/lastOrderAt (FR-13.x), so a segment is always current
 * (FR-50.4) and there is no separately-maintained member list to drift.
 */
@Injectable()
export class CustomerSegmentsService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly settings: SettingsService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  /** Module 75 (FR-7.23) - plan-gated; read-only usage (list/getOne/previewCount) of already-saved segments is left ungated. */
  async create(sellerId: string, storeId: string, dto: CreateCustomerSegmentDto) {
    const planContext = await this.subscriptions.getPlanContext(sellerId);
    const enabled = await this.settings.resolve<boolean>("customer_segments.enabled", planContext);
    if (!enabled) throw new ForbiddenException("Customer segments are not included in your current plan.");

    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");
      return tx.customerSegment.create({ data: { storeId, ...this.toCriteriaData(dto), name: dto.name } });
    });
  }

  async list(sellerId: string, storeId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");
      const segments = await tx.customerSegment.findMany({ where: { storeId }, orderBy: { createdAt: "desc" } });
      const withCounts = await Promise.all(
        segments.map(async (segment) => ({
          ...segment,
          memberCount: (await this.matchCustomers(tx, storeId, this.segmentToCriteria(segment))).length,
        })),
      );
      return withCounts;
    });
  }

  async getOne(sellerId: string, storeId: string, segmentId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const segment = await tx.customerSegment.findUnique({ where: { id: segmentId } });
      if (!segment || segment.storeId !== storeId) throw new NotFoundException("Segment not found.");
      const members = await this.matchCustomers(tx, storeId, this.segmentToCriteria(segment));
      return { ...segment, members };
    });
  }

  async update(sellerId: string, storeId: string, segmentId: string, dto: UpdateCustomerSegmentDto) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const existing = await tx.customerSegment.findUnique({ where: { id: segmentId } });
      if (!existing || existing.storeId !== storeId) throw new NotFoundException("Segment not found.");
      return tx.customerSegment.update({ where: { id: segmentId }, data: { ...this.toCriteriaData(dto), name: dto.name } });
    });
  }

  async remove(sellerId: string, storeId: string, segmentId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const existing = await tx.customerSegment.findUnique({ where: { id: segmentId } });
      if (!existing || existing.storeId !== storeId) throw new NotFoundException("Segment not found.");
      await tx.customerSegment.delete({ where: { id: segmentId } });
      return { deleted: true };
    });
  }

  /** FR-50.4 - preview a member count for unsaved criteria, before creating the segment. */
  async previewCount(sellerId: string, storeId: string, dto: PreviewCustomerSegmentDto) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");
      const members = await this.matchCustomers(tx, storeId, this.toCriteria(dto));
      return { count: members.length };
    });
  }

  private segmentToCriteria(segment: CustomerSegment): SegmentCriteria {
    return {
      minOrders: segment.minOrders,
      maxOrders: segment.maxOrders,
      minTotalSpent: segment.minTotalSpent != null ? Number(segment.minTotalSpent) : null,
      maxTotalSpent: segment.maxTotalSpent != null ? Number(segment.maxTotalSpent) : null,
      lastOrderAfter: segment.lastOrderAfter,
      lastOrderBefore: segment.lastOrderBefore,
      locationCity: segment.locationCity,
      locationCountry: segment.locationCountry,
    };
  }

  private toCriteria(dto: {
    minOrders?: number;
    maxOrders?: number;
    minTotalSpent?: number;
    maxTotalSpent?: number;
    lastOrderAfter?: string;
    lastOrderBefore?: string;
    locationCity?: string;
    locationCountry?: string;
  }): SegmentCriteria {
    return {
      minOrders: dto.minOrders ?? null,
      maxOrders: dto.maxOrders ?? null,
      minTotalSpent: dto.minTotalSpent ?? null,
      maxTotalSpent: dto.maxTotalSpent ?? null,
      lastOrderAfter: dto.lastOrderAfter ? new Date(dto.lastOrderAfter) : null,
      lastOrderBefore: dto.lastOrderBefore ? new Date(dto.lastOrderBefore) : null,
      locationCity: dto.locationCity ?? null,
      locationCountry: dto.locationCountry ?? null,
    };
  }

  private toCriteriaData(dto: {
    minOrders?: number;
    maxOrders?: number;
    minTotalSpent?: number;
    maxTotalSpent?: number;
    lastOrderAfter?: string;
    lastOrderBefore?: string;
    locationCity?: string;
    locationCountry?: string;
  }) {
    return {
      minOrders: dto.minOrders,
      maxOrders: dto.maxOrders,
      minTotalSpent: dto.minTotalSpent,
      maxTotalSpent: dto.maxTotalSpent,
      lastOrderAfter: dto.lastOrderAfter ? new Date(dto.lastOrderAfter) : undefined,
      lastOrderBefore: dto.lastOrderBefore ? new Date(dto.lastOrderBefore) : undefined,
      locationCity: dto.locationCity,
      locationCountry: dto.locationCountry,
    };
  }

  /**
   * FR-50.2/50.3 - numeric/date bounds are pushed down into the DB query
   * (cheap, indexable); location is resolved afterward from each candidate's
   * most recent order and applied via the same matchesSegmentCriteria()
   * every caller shares, so "matches this segment" has one definition.
   */
  private async matchCustomers(
    tx: Prisma.TransactionClient,
    storeId: string,
    criteria: SegmentCriteria,
  ): Promise<Customer[]> {
    const candidates = await tx.customer.findMany({
      where: {
        storeId,
        ...(criteria.minOrders != null || criteria.maxOrders != null
          ? { ordersCount: { gte: criteria.minOrders ?? undefined, lte: criteria.maxOrders ?? undefined } }
          : {}),
        ...(criteria.minTotalSpent != null || criteria.maxTotalSpent != null
          ? { totalSpent: { gte: criteria.minTotalSpent ?? undefined, lte: criteria.maxTotalSpent ?? undefined } }
          : {}),
        ...(criteria.lastOrderAfter != null || criteria.lastOrderBefore != null
          ? { lastOrderAt: { gte: criteria.lastOrderAfter ?? undefined, lte: criteria.lastOrderBefore ?? undefined } }
          : {}),
      },
    });

    if (!criteria.locationCity && !criteria.locationCountry) {
      return candidates;
    }

    const locations = await this.latestOrderLocationsByCustomer(
      tx,
      storeId,
      candidates.map((c) => c.id),
    );
    return candidates.filter((c) => matchesSegmentCriteria(this.toMatchable(c), locations.get(c.id) ?? null, criteria));
  }

  private toMatchable(customer: Customer): CustomerForMatching {
    return { ordersCount: customer.ordersCount, totalSpent: Number(customer.totalSpent), lastOrderAt: customer.lastOrderAt };
  }

  /** FR-50.3 - one query, reduced to the most-recent order per customer (orders arrive pre-sorted by placedAt desc). */
  private async latestOrderLocationsByCustomer(
    tx: Prisma.TransactionClient,
    storeId: string,
    customerIds: string[],
  ): Promise<Map<string, LocationForMatching>> {
    const map = new Map<string, LocationForMatching>();
    if (customerIds.length === 0) return map;

    const orders = await tx.order.findMany({
      where: { storeId, customerId: { in: customerIds } },
      orderBy: { placedAt: "desc" },
      select: { customerId: true, shippingAddress: true },
    });
    for (const order of orders) {
      if (!order.customerId || map.has(order.customerId)) continue;
      const address = order.shippingAddress as { city?: string; country?: string };
      if (address?.city && address?.country) {
        map.set(order.customerId, { city: address.city, country: address.country });
      }
    }
    return map;
  }
}
