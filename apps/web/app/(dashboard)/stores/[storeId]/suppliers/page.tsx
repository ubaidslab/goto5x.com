"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { Reveal } from "@/components/motion/Reveal";
import { ApiError, api } from "@/lib/dashboard-api";

type LinkStatus = "pending_seller_review" | "active" | "revoked";
type ReviewStatus = "pending" | "approved" | "rejected";

interface SupplierLink {
  id: string;
  supplierId: string;
  status: LinkStatus;
  invitedBy: "seller" | "supplier";
  createdAt: string;
  supplier: { businessName: string; verificationStatus: string } | null;
}
interface ListingReview {
  id: string;
  status: ReviewStatus;
  createdAt: string;
  supplierListing: { title: string; price: string; shippingCost: string; supplier: { businessName: string } } | null;
}

const statusTone: Record<LinkStatus, "neutral" | "success" | "warning"> = {
  pending_seller_review: "warning",
  active: "success",
  revoked: "neutral",
};
const statusLabel: Record<LinkStatus, string> = {
  pending_seller_review: "needs your review",
  active: "active",
  revoked: "revoked",
};
const reviewStatusTone: Record<ReviewStatus, "neutral" | "success" | "warning" | "danger"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
};

/**
 * Optional by design (SIMPLICITY INVARIANT): a self-fulfilled seller with no
 * supplier connections never needs this screen - the sidebar only links here
 * once at least one supplier link exists (see Sidebar.tsx).
 */
export default function SupplierLinksPage({ params }: { params: { storeId: string } }) {
  const [links, setLinks] = useState<SupplierLink[] | null>(null);
  const [reviews, setReviews] = useState<ListingReview[] | null>(null);
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decidingReview, setDecidingReview] = useState<string | null>(null);
  const [decidingLinkId, setDecidingLinkId] = useState<string | null>(null);

  function load() {
    api
      .get<SupplierLink[]>(`/stores/${params.storeId}/supplier-links`)
      .then(setLinks)
      .catch(() => setLinks([]));
  }

  function loadReviews() {
    api
      .get<ListingReview[]>(`/stores/${params.storeId}/listing-reviews`)
      .then(setReviews)
      .catch(() => setReviews([]));
  }

  useEffect(load, [params.storeId]);
  useEffect(loadReviews, [params.storeId]);

  if (!links || !reviews) return <PageSpinner />;

  async function decideReview(reviewId: string, decision: "approve" | "reject") {
    setError(null);
    setDecidingReview(reviewId);
    try {
      await api.patch(`/stores/${params.storeId}/listing-reviews/${reviewId}/${decision}`);
      loadReviews();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Couldn't ${decision} that listing.`);
    } finally {
      setDecidingReview(null);
    }
  }

  const pendingReviews = reviews.filter((r) => r.status === "pending");
  const decidedReviews = reviews.filter((r) => r.status !== "pending").slice(0, 10);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInviting(true);
    try {
      await api.post(`/stores/${params.storeId}/supplier-links`, { supplierEmail: email });
      setEmail("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't invite that supplier.");
    } finally {
      setInviting(false);
    }
  }

  async function approve(linkId: string) {
    setError(null);
    setDecidingLinkId(linkId);
    try {
      await api.patch(`/stores/${params.storeId}/supplier-links/${linkId}/approve`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't approve that link.");
    } finally {
      setDecidingLinkId(null);
    }
  }

  async function revoke(linkId: string) {
    setError(null);
    setDecidingLinkId(linkId);
    try {
      await api.patch(`/stores/${params.storeId}/supplier-links/${linkId}/revoke`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't revoke that link.");
    } finally {
      setDecidingLinkId(null);
    }
  }

  return (
    <div>
      <PageHeader title="Suppliers" description="Local suppliers whose products you can list and sell from your store." />

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader title="Invite a supplier" description="Enter the email address they used to sign up as a supplier." />
          <CardBody>
            <form onSubmit={invite} className="flex items-end gap-2">
              <div className="flex-1">
                <Field label="Supplier email">
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </Field>
              </div>
              <Button type="submit" loading={inviting}>
                Invite
              </Button>
            </form>
          </CardBody>
        </Card>

        {links.length === 0 ? (
          <Card>
            <EmptyState
              title="No suppliers connected"
              description="Selling entirely your own products? You can ignore this screen - it's only needed if you want to list another supplier's products."
            />
          </Card>
        ) : (
          <Card className="divide-y divide-border overflow-hidden">
            <Reveal stagger={0.04}>
            {links.map((link) => (
              <div key={link.id} className="flex items-center justify-between gap-4 px-6 py-4">
                <div>
                  <p className="text-sm font-medium text-ink">{link.supplier?.businessName ?? `Supplier ${link.supplierId.slice(0, 8)}`}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {link.invitedBy === "seller" ? "You invited this supplier" : "This supplier requested to connect"} ·{" "}
                    {new Date(link.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={statusTone[link.status]}>{statusLabel[link.status]}</Badge>
                  {link.status === "pending_seller_review" && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => approve(link.id)}
                      loading={decidingLinkId === link.id}
                      disabled={decidingLinkId !== null && decidingLinkId !== link.id}
                    >
                      Approve
                    </Button>
                  )}
                  {link.status === "active" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => revoke(link.id)}
                      loading={decidingLinkId === link.id}
                      disabled={decidingLinkId !== null && decidingLinkId !== link.id}
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              </div>
            ))}
            </Reveal>
          </Card>
        )}

        <div>
          <h2 className="mb-1 text-sm font-semibold text-ink">Listing reviews</h2>
          <p className="mb-3 text-xs text-ink-muted">
            A connected supplier submits their products here before they go live on your store - nothing lists without your approval.
          </p>

          {pendingReviews.length === 0 && decidedReviews.length === 0 ? (
            <Card>
              <EmptyState title="No listings submitted yet" description="Once a connected supplier submits a product, it'll show up here for your approval." />
            </Card>
          ) : (
            <div className="space-y-4">
              {pendingReviews.length > 0 && (
                <Card className="divide-y divide-border overflow-hidden">
                  {pendingReviews.map((review) => (
                    <div key={review.id} className="flex items-center justify-between gap-4 px-6 py-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{review.supplierListing?.title ?? "Untitled listing"}</p>
                        <p className="mt-0.5 text-xs text-ink-muted">
                          {review.supplierListing?.supplier.businessName ?? "Unknown supplier"} · Rs {review.supplierListing?.price}
                          {review.supplierListing && Number(review.supplierListing.shippingCost) > 0 && ` + Rs ${review.supplierListing.shippingCost} shipping`}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          loading={decidingReview === review.id}
                          onClick={() => decideReview(review.id, "approve")}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={decidingReview === review.id}
                          onClick={() => decideReview(review.id, "reject")}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </Card>
              )}

              {decidedReviews.length > 0 && (
                <Card className="divide-y divide-border overflow-hidden">
                  {decidedReviews.map((review) => (
                    <div key={review.id} className="flex items-center justify-between gap-4 px-6 py-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-ink">{review.supplierListing?.title ?? "Untitled listing"}</p>
                        <p className="mt-0.5 text-xs text-ink-muted">{review.supplierListing?.supplier.businessName ?? "Unknown supplier"}</p>
                      </div>
                      <Badge tone={reviewStatusTone[review.status]}>{review.status}</Badge>
                    </div>
                  ))}
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
