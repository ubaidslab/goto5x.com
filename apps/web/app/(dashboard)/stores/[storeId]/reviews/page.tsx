"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Select } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { Reveal } from "@/components/motion/Reveal";
import { toast } from "@/lib/use-toast";
import { ApiError, api } from "@/lib/dashboard-api";

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 align-text-bottom" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={`h-3.5 w-3.5 ${i < rating ? "fill-accent text-accent" : "text-border-strong"}`} />
      ))}
    </span>
  );
}

type ReviewStatus = "pending" | "approved" | "hidden";

interface Review {
  id: string;
  buyerName: string;
  rating: number;
  body: string;
  isVerifiedPurchase: boolean;
  status: ReviewStatus;
  createdAt: string;
  product: { title: string };
}

export default function ReviewsModerationPage({ params }: { params: { storeId: string } }) {
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [status, setStatus] = useState<ReviewStatus | "">("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    const query = status ? `?status=${status}` : "";
    api
      .get<Review[]>(`/stores/${params.storeId}/reviews${query}`)
      .then(setReviews)
      .catch(() => setReviews([]));
  }

  useEffect(load, [params.storeId, status]);

  async function moderate(reviewId: string, next: "approved" | "hidden") {
    setError(null);
    setBusyId(reviewId);
    try {
      await api.patch(`/stores/${params.storeId}/reviews/${reviewId}`, { status: next });
      toast({ tone: "success", title: next === "approved" ? "Review approved" : "Review hidden" });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update that review.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader title="Reviews" description="Approve or hide reviews before they count toward a product's rating." />

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      <div className="mb-4 max-w-xs">
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value as ReviewStatus | "")}>
            <option value="pending">Awaiting moderation</option>
            <option value="approved">Approved</option>
            <option value="hidden">Hidden</option>
            <option value="">All</option>
          </Select>
        </Field>
      </div>

      {reviews === null ? (
        <PageSpinner />
      ) : reviews.length === 0 ? (
        <Card>
          <EmptyState
            title={status === "pending" ? "Nothing awaiting moderation" : "No reviews here"}
            description="Buyer-submitted reviews appear here from the order-status page."
          />
        </Card>
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          <Reveal stagger={0.04}>
          {reviews.map((review) => (
            <div key={review.id} className="px-6 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium text-ink">
                    <span className="truncate">{review.product.title}</span> · <StarRating rating={review.rating} />
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {review.buyerName} · {new Date(review.createdAt).toLocaleDateString()}
                    {review.isVerifiedPurchase && (
                      <>
                        {" · "}
                        <Badge tone="success">verified purchase</Badge>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {review.status !== "approved" && (
                    <Button
                      variant="secondary"
                      loading={busyId === review.id}
                      onClick={() => moderate(review.id, "approved")}
                    >
                      Approve
                    </Button>
                  )}
                  {review.status !== "hidden" && (
                    <Button variant="ghost" loading={busyId === review.id} onClick={() => moderate(review.id, "hidden")}>
                      Hide
                    </Button>
                  )}
                </div>
              </div>
              <p className="mt-2 text-sm text-ink-muted">{review.body}</p>
            </div>
          ))}
          </Reveal>
        </Card>
      )}
    </div>
  );
}
