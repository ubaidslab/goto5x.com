"use client";

import { useEffect, useState } from "react";
import { Play, Star } from "lucide-react";
import { useConfirm } from "@/components/dashboard/ConfirmDialogProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select } from "@/components/ui/Field";
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

type ReviewStatus = "pending" | "approved" | "hidden" | "deleted";

interface ReviewMediaItem {
  id: string;
  type: "image" | "video";
  url: string;
}

interface Review {
  id: string;
  buyerName: string;
  buyerEmail: string;
  rating: number;
  body: string;
  isVerifiedPurchase: boolean;
  status: ReviewStatus;
  createdAt: string;
  orderId: string | null;
  deletedAt: string | null;
  deletedReason: string | null;
  product: { title: string };
  media: ReviewMediaItem[];
}

export default function ReviewsModerationPage({ params }: { params: { storeId: string } }) {
  const confirm = useConfirm();
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [status, setStatus] = useState<ReviewStatus | "">("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lightboxMedia, setLightboxMedia] = useState<ReviewMediaItem | null>(null);
  const [detailReview, setDetailReview] = useState<Review | null>(null);
  const [deleteReason, setDeleteReason] = useState("");

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

  function openDetail(review: Review) {
    setDeleteReason("");
    setDetailReview(review);
  }

  /**
   * SRS §5.14/FR-14.6 (Module 93) - a harder, one-way action from the
   * seller's perspective, gated behind the detail view (not a quick inline
   * list-row button like approve/hide) and a required reason, exactly the
   * server-side requirement ReviewsService.moderate() enforces.
   */
  async function deleteReview(review: Review) {
    if (!deleteReason.trim()) {
      setError("A reason is required to delete a review.");
      return;
    }
    const ok = await confirm({
      title: `Delete this review?`,
      description: "This removes it from the product's rating immediately and cannot be undone from here - the review and your reason stay on record for audit purposes.",
      changes: [{ label: "Reason", from: "-", to: deleteReason.trim() }],
      confirmLabel: "Delete review",
      tone: "danger",
    });
    if (!ok) return;

    setError(null);
    setBusyId(review.id);
    try {
      await api.patch(`/stores/${params.storeId}/reviews/${review.id}`, { status: "deleted", reason: deleteReason.trim() });
      toast({ tone: "success", title: "Review deleted" });
      setDetailReview(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete that review.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader title="Reviews" description="Approve, hide, or delete reviews before they count toward a product's rating." />

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      <div className="mb-4 max-w-xs">
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value as ReviewStatus | "")}>
            <option value="pending">Awaiting moderation</option>
            <option value="approved">Approved</option>
            <option value="hidden">Hidden</option>
            <option value="deleted">Deleted</option>
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
                    {review.status === "deleted" && (
                      <>
                        {" · "}
                        <Badge tone="danger">deleted</Badge>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {review.status !== "deleted" && review.status !== "approved" && (
                    <Button
                      variant="secondary"
                      loading={busyId === review.id}
                      onClick={() => moderate(review.id, "approved")}
                    >
                      Approve
                    </Button>
                  )}
                  {review.status !== "deleted" && review.status !== "hidden" && (
                    <Button variant="ghost" loading={busyId === review.id} onClick={() => moderate(review.id, "hidden")}>
                      Hide
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => openDetail(review)}>
                    Details
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-sm text-ink-muted">{review.body}</p>
              {review.media.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {review.media.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setLightboxMedia(item)}
                      className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-border transition-smooth-fast hover:border-border-strong"
                    >
                      {item.type === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.url} alt={`Attachment from ${review.buyerName}'s review`} className="h-full w-full object-cover" />
                      ) : (
                        <>
                          <video src={item.url} className="h-full w-full object-cover" muted />
                          <span className="absolute inset-0 flex items-center justify-center bg-ink/30">
                            <Play className="h-5 w-5 fill-white text-white" />
                          </span>
                        </>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          </Reveal>
        </Card>
      )}

      {/* SRS §5.14/FR-14.5 (Module 93) - the review detail view: full record
          (buyer email, order reference, full media gallery, deletion
          reason/timestamp once deleted) plus the delete action, gated
          behind this extra step and a required reason rather than a quick
          inline list-row button. */}
      <Dialog open={detailReview !== null} onOpenChange={(open) => !open && setDetailReview(null)}>
        <DialogContent className="max-w-lg">
          {detailReview && (
            <>
              <DialogHeader>
                <DialogTitle>{detailReview.product.title}</DialogTitle>
                <DialogDescription>
                  <StarRating rating={detailReview.rating} /> · {new Date(detailReview.createdAt).toLocaleString()}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={detailReview.status === "approved" ? "success" : detailReview.status === "deleted" ? "danger" : "neutral"}>
                    {detailReview.status}
                  </Badge>
                  {detailReview.isVerifiedPurchase && <Badge tone="success">verified purchase</Badge>}
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-ink-muted">
                  <p>
                    <span className="text-ink-faint">Buyer:</span> {detailReview.buyerName}
                  </p>
                  <p>
                    <span className="text-ink-faint">Email:</span> {detailReview.buyerEmail}
                  </p>
                  <p className="col-span-2">
                    <span className="text-ink-faint">Order:</span> {detailReview.orderId ?? "Not linked to an order"}
                  </p>
                </div>

                <p className="whitespace-pre-wrap text-ink">{detailReview.body}</p>

                {detailReview.media.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {detailReview.media.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setLightboxMedia(item)}
                        className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md border border-border transition-smooth-fast hover:border-border-strong"
                      >
                        {item.type === "image" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.url} alt={`Attachment from ${detailReview.buyerName}'s review`} className="h-full w-full object-cover" />
                        ) : (
                          <>
                            <video src={item.url} className="h-full w-full object-cover" muted />
                            <span className="absolute inset-0 flex items-center justify-center bg-ink/30">
                              <Play className="h-5 w-5 fill-white text-white" />
                            </span>
                          </>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {detailReview.status === "deleted" ? (
                  <div className="rounded-md border border-danger-subtle bg-danger-subtle/40 p-3 text-xs text-danger">
                    Deleted {detailReview.deletedAt && new Date(detailReview.deletedAt).toLocaleString()}
                    <br />
                    Reason: {detailReview.deletedReason}
                  </div>
                ) : (
                  <div className="space-y-2 border-t border-border pt-3">
                    <Field label="Reason (required to delete)">
                      <Input value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} />
                    </Field>
                    <div className="flex flex-wrap gap-2">
                      {detailReview.status !== "approved" && (
                        <Button variant="secondary" loading={busyId === detailReview.id} onClick={() => moderate(detailReview.id, "approved")}>
                          Approve
                        </Button>
                      )}
                      {detailReview.status !== "hidden" && (
                        <Button variant="ghost" loading={busyId === detailReview.id} onClick={() => moderate(detailReview.id, "hidden")}>
                          Hide
                        </Button>
                      )}
                      <Button variant="danger" loading={busyId === detailReview.id} onClick={() => deleteReview(detailReview)}>
                        Delete review
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={lightboxMedia !== null} onOpenChange={(open) => !open && setLightboxMedia(null)}>
        <DialogContent className="max-w-2xl">
          {lightboxMedia?.type === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lightboxMedia.url} alt="Review attachment, full view" className="w-full rounded-md" />
          ) : lightboxMedia ? (
            <video src={lightboxMedia.url} controls autoPlay className="w-full rounded-md" />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
