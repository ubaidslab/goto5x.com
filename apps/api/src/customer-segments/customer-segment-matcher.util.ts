/**
 * FR-50.2/50.3 - the single evaluation function both CustomerSegmentsService's
 * DB-filtered query and its location post-filter share, so "does this
 * customer match this segment" has exactly one definition, never two that
 * could drift.
 */
export interface SegmentCriteria {
  minOrders?: number | null;
  maxOrders?: number | null;
  minTotalSpent?: number | null;
  maxTotalSpent?: number | null;
  lastOrderAfter?: Date | null;
  lastOrderBefore?: Date | null;
  locationCity?: string | null;
  locationCountry?: string | null;
}

export interface CustomerForMatching {
  ordersCount: number;
  totalSpent: number;
  lastOrderAt: Date | null;
}

export interface LocationForMatching {
  city: string;
  country: string;
}

export function matchesSegmentCriteria(
  customer: CustomerForMatching,
  latestOrderLocation: LocationForMatching | null,
  criteria: SegmentCriteria,
): boolean {
  if (criteria.minOrders != null && customer.ordersCount < criteria.minOrders) return false;
  if (criteria.maxOrders != null && customer.ordersCount > criteria.maxOrders) return false;
  if (criteria.minTotalSpent != null && customer.totalSpent < criteria.minTotalSpent) return false;
  if (criteria.maxTotalSpent != null && customer.totalSpent > criteria.maxTotalSpent) return false;
  if (criteria.lastOrderAfter != null && (!customer.lastOrderAt || customer.lastOrderAt < criteria.lastOrderAfter)) {
    return false;
  }
  if (criteria.lastOrderBefore != null && (!customer.lastOrderAt || customer.lastOrderAt > criteria.lastOrderBefore)) {
    return false;
  }
  if (
    criteria.locationCity &&
    (!latestOrderLocation || latestOrderLocation.city.toLowerCase() !== criteria.locationCity.toLowerCase())
  ) {
    return false;
  }
  if (
    criteria.locationCountry &&
    (!latestOrderLocation || latestOrderLocation.country.toLowerCase() !== criteria.locationCountry.toLowerCase())
  ) {
    return false;
  }
  return true;
}
