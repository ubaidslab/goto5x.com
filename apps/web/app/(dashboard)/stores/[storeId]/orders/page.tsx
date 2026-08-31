"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { Reveal } from "@/components/motion/Reveal";
import { ApiError, api } from "@/lib/dashboard-api";

type OrderStatus = "pending" | "confirmed" | "shipped" | "delivered" | "completed" | "cancelled" | "disputed";
type OrderBucket = "pending" | "awaitingVerification" | "prepaidReceived" | "awaitingTracking" | "shipped" | "delivered" | "cancelledReturned";
type OrderItemFulfillmentStatus = "pending" | "confirmed" | "shipped" | "delivered" | "completed";
// SRS §5.38/FR-38.7/38.10 - the buyer-facing 4-state bucket, computed
// server-side by the same mapping function the buyer's status page uses
// (buyerFacingTrackingState() in order-timeline.util.ts) so the two can
// never show two different buckets for one order.
type BuyerFacingTrackingState = "pending" | "submitted_to_courier" | "delivered" | "cancelled";

interface OrderItem {
  id: string;
  fulfillmentStatus: OrderItemFulfillmentStatus;
}
interface Order {
  id: string;
  orderNumber: number;
  buyerEmail: string;
  status: OrderStatus;
  trackingState: BuyerFacingTrackingState;
  totalAmount: string;
  currency: string;
  tags: string[];
  placedAt: string;
  items: OrderItem[];
}
interface OrderListPageResponse {
  items: Order[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
interface OrdersOverview {
  buckets: Record<OrderBucket, number>;
  total: number;
  supplierItemsAwaitingFulfillment: number;
}
interface RowError {
  row: number;
  message: string;
}
interface ImportJob {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  unmappedFields: string[];
  errorLog: RowError[] | null;
  createdAt: string;
}

// FR-38.10 - the same 4-state at-a-glance badge the buyer sees.
const trackingStateTone: Record<BuyerFacingTrackingState, "neutral" | "success" | "warning" | "info"> = {
  pending: "warning",
  submitted_to_courier: "info",
  delivered: "success",
  cancelled: "neutral",
};
const trackingStateLabel: Record<BuyerFacingTrackingState, string> = {
  pending: "Pending",
  submitted_to_courier: "Submitted to Courier",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const BUCKET_LABELS: { bucket: OrderBucket; label: string }[] = [
  { bucket: "pending", label: "Pending" },
  { bucket: "awaitingVerification", label: "Awaiting verification" },
  { bucket: "prepaidReceived", label: "Prepaid received" },
  { bucket: "awaitingTracking", label: "Awaiting tracking" },
  { bucket: "shipped", label: "Shipped" },
  { bucket: "delivered", label: "Delivered" },
  { bucket: "cancelledReturned", label: "Cancelled / returned" },
];

const emptyFilters = {
  status: "",
  dateFrom: "",
  dateTo: "",
  paymentStatus: "",
  verificationStatus: "",
  courier: "",
  customer: "",
  minAmount: "",
  maxAmount: "",
};

type BulkAction = "" | "markPaid" | "fulfill" | "cancel" | "dispute" | "complete";

const BULK_ACTION_LABELS: Record<Exclude<BulkAction, "">, string> = {
  markPaid: "Mark as paid",
  fulfill: "Mark items delivered (fulfill)",
  cancel: "Cancel",
  dispute: "Mark disputed",
  complete: "Mark completed",
};

/**
 * SRS §5.59/FR-59.2-59.5 (Module 52) - multi-select bulk actions, three
 * tracking-entry paths (inline quick-entry here + CSV upload; the existing
 * per-order detail entry is unchanged), advanced filters, and pagination -
 * on top of the pre-existing bucket click-through (FR-38.2). Bulk actions
 * reuse the existing single-order endpoints via the same client-side
 * fan-out precedent as Module 51's bulk product actions - never a bare
 * `updateMany`, so commission accrual/customer stats/order.placed keep
 * firing correctly for every order in a batch.
 */
export default function OrdersListPage({ params }: { params: { storeId: string } }) {
  const [ordersPage, setOrdersPage] = useState<OrderListPageResponse | null>(null);
  const [overview, setOverview] = useState<OrdersOverview | null>(null);
  const [bucket, setBucket] = useState<OrderBucket | "">("");
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<BulkAction>("");
  const [confirming, setConfirming] = useState(false);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const [trackingDrafts, setTrackingDrafts] = useState<Record<string, { trackingId: string; carrier: string }>>({});
  const [savingTrackingFor, setSavingTrackingFor] = useState<string | null>(null);
  const [trackingErrors, setTrackingErrors] = useState<Record<string, string>>({});

  const [csvUploading, setCsvUploading] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [recentTrackingJobs, setRecentTrackingJobs] = useState<ImportJob[]>([]);
  const csvInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .get<OrdersOverview>(`/stores/${params.storeId}/orders/overview`)
      .then(setOverview)
      .catch(() => setOverview(null));
  }, [params.storeId]);

  function reload() {
    const query = new URLSearchParams({ page: String(page), limit: "20" });
    if (bucket) query.set("bucket", bucket);
    if (filters.status) query.set("status", filters.status);
    if (filters.dateFrom) query.set("dateFrom", new Date(filters.dateFrom).toISOString());
    if (filters.dateTo) query.set("dateTo", new Date(filters.dateTo).toISOString());
    if (filters.paymentStatus) query.set("paymentStatus", filters.paymentStatus);
    if (filters.verificationStatus) query.set("verificationStatus", filters.verificationStatus);
    if (filters.courier) query.set("courier", filters.courier);
    if (filters.customer) query.set("customer", filters.customer);
    if (filters.minAmount) query.set("minAmount", filters.minAmount);
    if (filters.maxAmount) query.set("maxAmount", filters.maxAmount);
    api
      .get<OrderListPageResponse>(`/stores/${params.storeId}/orders?${query.toString()}`)
      .then(setOrdersPage)
      .catch(() => setOrdersPage({ items: [], page: 1, limit: 20, total: 0, totalPages: 1 }));
  }

  useEffect(reload, [params.storeId, bucket, filters, page]);

  function loadRecentTrackingJobs() {
    api
      .get<ImportJob[]>(`/stores/${params.storeId}/import-jobs?type=tracking_import`)
      .then((jobs) => setRecentTrackingJobs(jobs.slice(0, 3)))
      .catch(() => setRecentTrackingJobs([]));
  }

  useEffect(loadRecentTrackingJobs, [params.storeId]);

  function selectBucket(next: OrderBucket) {
    setFilters(emptyFilters);
    setBucket((prev) => (prev === next ? "" : next));
    setPage(1);
  }

  function setFilter<K extends keyof typeof emptyFilters>(key: K, value: string) {
    setBucket("");
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

  function toggleSelected(orderId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (!ordersPage) return;
    const pageIds = ordersPage.items.map((o) => o.id);
    const allSelected = pageIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  const selectedOrders = ordersPage ? ordersPage.items.filter((o) => selected.has(o.id)) : [];

  async function applyToOneOrder(order: Order): Promise<void> {
    switch (bulkAction) {
      case "markPaid":
        await api.post(`/stores/${params.storeId}/orders/${order.id}/mark-as-paid`, {});
        return;
      case "fulfill": {
        const undelivered = order.items.filter((i) => !["delivered", "completed"].includes(i.fulfillmentStatus));
        await Promise.all(undelivered.map((i) => api.post(`/stores/${params.storeId}/orders/${order.id}/items/${i.id}/deliver`, {})));
        return;
      }
      case "cancel":
        await api.patch(`/stores/${params.storeId}/orders/${order.id}/status`, { status: "cancelled" });
        return;
      case "dispute":
        await api.patch(`/stores/${params.storeId}/orders/${order.id}/status`, { status: "disputed" });
        return;
      case "complete":
        await api.patch(`/stores/${params.storeId}/orders/${order.id}/status`, { status: "completed" });
        return;
      default:
        return;
    }
  }

  async function executeBulk() {
    setBulkRunning(true);
    setBulkError(null);
    const results = await Promise.allSettled(selectedOrders.map((o) => applyToOneOrder(o)));
    const failures = results.filter((r) => r.status === "rejected").length;
    if (failures > 0) {
      setBulkError(
        `${failures} of ${selectedOrders.length} order${selectedOrders.length === 1 ? "" : "s"} couldn't be updated - the rest succeeded. Common cause: the order isn't in a state this action applies to.`,
      );
    }
    setBulkRunning(false);
    setConfirming(false);
    setSelected(new Set());
    setBulkAction("");
    reload();
  }

  function trackingDraft(orderId: string) {
    return trackingDrafts[orderId] ?? { trackingId: "", carrier: "" };
  }

  function setTrackingDraft(orderId: string, field: "trackingId" | "carrier", value: string) {
    setTrackingDrafts((prev) => ({ ...prev, [orderId]: { ...trackingDraft(orderId), [field]: value } }));
  }

  async function saveTracking(orderId: string) {
    const draft = trackingDraft(orderId);
    if (!draft.trackingId.trim()) return;
    setSavingTrackingFor(orderId);
    setTrackingErrors((prev) => ({ ...prev, [orderId]: "" }));
    try {
      await api.post(`/stores/${params.storeId}/orders/${orderId}/tracking`, {
        trackingId: draft.trackingId.trim(),
        carrier: draft.carrier.trim() || undefined,
      });
      setTrackingDrafts((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
      reload();
    } catch (err) {
      setTrackingErrors((prev) => ({ ...prev, [orderId]: err instanceof ApiError ? err.message : "Couldn't save tracking." }));
    } finally {
      setSavingTrackingFor(null);
    }
  }

  async function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvError(null);
    setCsvUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.upload(`/stores/${params.storeId}/tracking-import-jobs`, formData);
      loadRecentTrackingJobs();
      reload();
    } catch (err) {
      setCsvError(err instanceof ApiError ? err.message : "Couldn't upload that file.");
    } finally {
      setCsvUploading(false);
      if (csvInputRef.current) csvInputRef.current.value = "";
    }
  }

  const filtersActive = Object.values(filters).some(Boolean);

  if (ordersPage === null) return <PageSpinner />;

  return (
    <div>
      <PageHeader title="Orders" description="What needs your attention, at a glance, plus every order placed on your store." />

      {overview && (
        <Reveal className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4" stagger={0.06}>
          {BUCKET_LABELS.map(({ bucket: b, label }) => (
            <button
              key={b}
              type="button"
              onClick={() => selectBucket(b)}
              aria-pressed={bucket === b}
              className={`rounded-md border p-3 text-left transition-smooth-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas ${
                bucket === b ? "border-accent bg-accent/5" : "border-border bg-surface hover:border-border-strong"
              }`}
            >
              <p className="text-2xl font-semibold tabular-nums text-ink">{overview.buckets[b]}</p>
              <p className="text-xs text-ink-muted">{label}</p>
            </button>
          ))}
          {overview.supplierItemsAwaitingFulfillment > 0 && (
            <p className="col-span-2 self-center text-xs text-ink-muted sm:col-span-4">
              {overview.supplierItemsAwaitingFulfillment} supplier-fulfilled item(s) still awaiting fulfillment.
            </p>
          )}
        </Reveal>
      )}

      <Card className="mb-4 space-y-3 p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Field label="Status">
            <Select value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
              <option value="">All</option>
              <option value="pending">Awaiting payment</option>
              <option value="confirmed">Confirmed</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="disputed">Disputed</option>
            </Select>
          </Field>
          <Field label="Placed from">
            <Input type="datetime-local" value={filters.dateFrom} onChange={(e) => setFilter("dateFrom", e.target.value)} />
          </Field>
          <Field label="Placed to">
            <Input type="datetime-local" value={filters.dateTo} onChange={(e) => setFilter("dateTo", e.target.value)} />
          </Field>
          <Field label="Payment state">
            <Select value={filters.paymentStatus} onChange={(e) => setFilter("paymentStatus", e.target.value)}>
              <option value="">Any</option>
              <option value="pending">Pending</option>
              <option value="succeeded">Succeeded</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </Select>
          </Field>
          <Field label="Verification state">
            <Select value={filters.verificationStatus} onChange={(e) => setFilter("verificationStatus", e.target.value)}>
              <option value="">Any</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="failed">Failed</option>
              <option value="expired">Expired</option>
            </Select>
          </Field>
          <Field label="Courier">
            <Input placeholder="e.g. TCS" value={filters.courier} onChange={(e) => setFilter("courier", e.target.value)} />
          </Field>
          <Field label="Customer">
            <Input placeholder="Email or name" value={filters.customer} onChange={(e) => setFilter("customer", e.target.value)} />
          </Field>
          <Field label="Min amount (Rs)">
            <Input type="number" min={0} value={filters.minAmount} onChange={(e) => setFilter("minAmount", e.target.value)} />
          </Field>
          <Field label="Max amount (Rs)">
            <Input type="number" min={0} value={filters.maxAmount} onChange={(e) => setFilter("maxAmount", e.target.value)} />
          </Field>
          <div className="flex items-end">
            <Button
              variant="ghost"
              disabled={!filtersActive}
              onClick={() => {
                setFilters(emptyFilters);
                setPage(1);
              }}
            >
              Clear filters
            </Button>
          </div>
        </div>
        <p className="text-xs text-ink-muted">
          {ordersPage.total} order{ordersPage.total === 1 ? "" : "s"} match{ordersPage.total === 1 ? "es" : ""}
        </p>
      </Card>

      <Card className="mb-4 space-y-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-ink">Bulk tracking upload</p>
            <p className="text-xs text-ink-muted">A CSV with OrderNumber, Courier (optional), and TrackingId columns.</p>
          </div>
          <div>
            <input ref={csvInputRef} type="file" accept=".csv,text/csv" onChange={handleCsvUpload} className="hidden" id="tracking-import-csv-input" />
            <Button variant="secondary" loading={csvUploading} onClick={() => csvInputRef.current?.click()}>
              Upload tracking CSV
            </Button>
          </div>
        </div>
        {csvError && <p className="text-sm text-danger">{csvError}</p>}
        {recentTrackingJobs.map((job) => (
          <div key={job.id} className="rounded-md border border-border bg-canvas p-2 text-xs">
            <span className="text-ink-muted">{new Date(job.createdAt).toLocaleString()}</span> <Badge tone={job.status === "completed" ? "success" : job.status === "failed" ? "danger" : "info"}>{job.status}</Badge>
            {job.errorLog && job.errorLog.length > 0 && (
              <div className="mt-1 space-y-0.5 text-danger">
                {job.errorLog.slice(0, 5).map((rowError, i) => (
                  <p key={i}>{rowError.message}</p>
                ))}
              </div>
            )}
          </div>
        ))}
      </Card>

      {selected.size > 0 && (
        <Card className="mb-4 space-y-3 p-4">
          <p className="text-sm font-medium text-ink">
            {selected.size} order{selected.size === 1 ? "" : "s"} selected
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Bulk action">
              <Select
                value={bulkAction}
                onChange={(e) => {
                  setBulkAction(e.target.value as BulkAction);
                  setConfirming(false);
                }}
              >
                <option value="">Choose an action...</option>
                {Object.entries(BULK_ACTION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>

            {bulkAction && (
              <Button variant="ghost" onClick={() => setConfirming(true)}>
                {BULK_ACTION_LABELS[bulkAction as Exclude<BulkAction, "">]}...
              </Button>
            )}
          </div>

          {confirming && (
            <div className="rounded-md border border-border-strong bg-canvas p-3">
              <p className="text-sm text-ink">
                <strong>{BULK_ACTION_LABELS[bulkAction as Exclude<BulkAction, "">]}</strong> will affect {selectedOrders.length} order
                {selectedOrders.length === 1 ? "" : "s"}:
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                {selectedOrders
                  .slice(0, 5)
                  .map((o) => `#${o.orderNumber}`)
                  .join(", ")}
                {selectedOrders.length > 5 && ` and ${selectedOrders.length - 5} more`}
              </p>
              <div className="mt-3 flex gap-2">
                <Button loading={bulkRunning} onClick={executeBulk}>
                  Confirm
                </Button>
                <Button variant="ghost" disabled={bulkRunning} onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {bulkError && <p className="text-sm text-danger">{bulkError}</p>}
        </Card>
      )}

      {ordersPage.items.length === 0 ? (
        <Card>
          <EmptyState
            title={filtersActive || bucket ? "No orders match this filter" : "No orders yet"}
            description={
              filtersActive || bucket ? "Try a different filter." : "Orders placed on your storefront (or added manually) will show up here."
            }
          />
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <div className="flex items-center gap-4 border-b border-border px-6 py-2">
              <Checkbox
                aria-label="Select all orders on this page"
                checked={ordersPage.items.every((o) => selected.has(o.id))}
                onCheckedChange={toggleSelectAll}
              />
              <span className="text-xs text-ink-muted">Select all on this page</span>
            </div>
            <Reveal className="divide-y divide-border" stagger={0.03}>
              {ordersPage.items.map((order) => {
                const draft = trackingDraft(order.id);
                return (
                  <div key={order.id} className="flex flex-col gap-2 px-6 py-4 transition-smooth-fast hover:bg-canvas/60">
                    <div className="flex items-center gap-4">
                      <Checkbox
                        aria-label={`Select order #${order.orderNumber}`}
                        checked={selected.has(order.id)}
                        onCheckedChange={() => toggleSelected(order.id)}
                      />
                      <Link
                        href={`/stores/${params.storeId}/orders/${order.id}`}
                        className="flex flex-1 items-center justify-between gap-4 transition-smooth-fast hover:opacity-80"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">
                            #{order.orderNumber} · {order.buyerEmail}
                          </p>
                          <p className="mt-0.5 text-xs text-ink-muted">
                            {new Date(order.placedAt).toLocaleDateString()} · {order.currency} {order.totalAmount}
                            {order.tags.length > 0 && ` · ${order.tags.join(", ")}`}
                          </p>
                        </div>
                        <Badge tone={trackingStateTone[order.trackingState]}>{trackingStateLabel[order.trackingState]}</Badge>
                      </Link>
                    </div>
                    {order.status === "confirmed" && (
                      <div className="ml-8 flex flex-wrap items-center gap-2">
                        <Input
                          placeholder="Tracking ID"
                          className="h-8 w-40"
                          value={draft.trackingId}
                          onChange={(e) => setTrackingDraft(order.id, "trackingId", e.target.value)}
                        />
                        <Input
                          placeholder="Courier (optional)"
                          className="h-8 w-40"
                          value={draft.carrier}
                          onChange={(e) => setTrackingDraft(order.id, "carrier", e.target.value)}
                        />
                        <Button
                          variant="ghost"
                          className="h-8"
                          disabled={!draft.trackingId.trim()}
                          loading={savingTrackingFor === order.id}
                          onClick={() => saveTracking(order.id)}
                        >
                          Save tracking
                        </Button>
                        {trackingErrors[order.id] && <span className="text-xs text-danger">{trackingErrors[order.id]}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </Reveal>
          </Card>

          {ordersPage.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <Button variant="ghost" disabled={ordersPage.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Previous
              </Button>
              <span className="text-sm text-ink-muted">
                Page {ordersPage.page} of {ordersPage.totalPages}
              </span>
              <Button
                variant="ghost"
                disabled={ordersPage.page >= ordersPage.totalPages}
                onClick={() => setPage((p) => Math.min(ordersPage.totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
