"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { ApiError, api } from "@/lib/dashboard-api";

interface EligibilityCriterion {
  key: string;
  label: string;
  pass: boolean;
  detail: string;
}

interface EligibilityResponse {
  criteria: EligibilityCriterion[];
  allPass: boolean;
}

type VerifiedStatus = "not_verified" | "pending_re_review" | "verified" | "revoked" | "expired";

interface StatusResponse {
  verifiedStatus: VerifiedStatus;
  verifiedSince: string | null;
  verifiedExpiresAt: string | null;
  reReviewReason: string | null;
}

interface Application {
  id: string;
  status: "pending_review" | "approved" | "rejected";
  feeAmount: number;
  currency: string;
  decisionNotes: string | null;
  createdAt: string;
}

const STATUS_LABEL: Record<VerifiedStatus, string> = {
  not_verified: "Not verified",
  pending_re_review: "Under re-review",
  verified: "Verified",
  revoked: "Revoked",
  expired: "Expired - re-application required",
};

/**
 * Module 23 (SRS §5.35, FR-35.1/35.2) - the live eligibility portal:
 * shows exactly which criteria pass/fail in plain language, and lets an
 * eligible seller apply. Passing every criterion means "you may apply,"
 * never "you will be approved" - the mandatory admin audit still decides.
 */
export default function VerifiedStorePage({ params }: { params: { storeId: string } }) {
  const [eligibility, setEligibility] = useState<EligibilityResponse | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [applications, setApplications] = useState<Application[] | null>(null);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadAll() {
    api.get<EligibilityResponse>(`/stores/${params.storeId}/verification/eligibility`).then(setEligibility).catch(() => {});
    api.get<StatusResponse>(`/stores/${params.storeId}/verification/status`).then(setStatus).catch(() => {});
    api.get<Application[]>(`/stores/${params.storeId}/verification/applications`).then(setApplications).catch(() => setApplications([]));
  }

  useEffect(loadAll, [params.storeId]);

  async function apply() {
    setError(null);
    setApplying(true);
    try {
      await api.post(`/stores/${params.storeId}/verification/apply`);
      loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit your application.");
    } finally {
      setApplying(false);
    }
  }

  if (eligibility === null || status === null || applications === null) return <PageSpinner />;

  const canApply = eligibility.allPass && (status.verifiedStatus === "not_verified" || status.verifiedStatus === "expired" || status.verifiedStatus === "revoked");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Verified Store"
        description="Earn a buyer-facing trust badge, shown on your storefront and at checkout. Eligibility is checked live - passing every criterion means you may apply, not that approval is guaranteed."
      />

      <Card>
        <CardBody className="flex items-center gap-3">
          <Badge tone={status.verifiedStatus === "verified" ? "success" : status.verifiedStatus === "pending_re_review" ? "warning" : "neutral"}>
            {STATUS_LABEL[status.verifiedStatus]}
          </Badge>
          {status.verifiedStatus === "verified" && status.verifiedExpiresAt && (
            <p className="text-xs text-ink-muted">Renews by {new Date(status.verifiedExpiresAt).toLocaleDateString()}</p>
          )}
          {status.verifiedStatus === "pending_re_review" && (
            <p className="text-xs text-ink-muted">Your badge is suspended pending admin re-review.</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Eligibility criteria" />
        <CardBody className="divide-y divide-border">
          {eligibility.criteria.map((c) => (
            <div key={c.key} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div>
                <p className="text-sm font-medium text-ink">{c.label}</p>
                <p className="text-sm text-ink-muted">{c.detail}</p>
              </div>
              <Badge tone={c.pass ? "success" : "neutral"}>{c.pass ? "Pass" : "Not yet"}</Badge>
            </div>
          ))}
        </CardBody>
      </Card>

      {error && <Alert>{error}</Alert>}

      {canApply && (
        <Card>
          <CardBody>
            <Button loading={applying} onClick={apply}>
              Apply for Verified Store
            </Button>
            <p className="mt-2 text-xs text-ink-muted">
              A processing fee will be debited from your wallet when you apply - this pays for the admin review, not the badge itself, and is refunded in full if your application is rejected.
            </p>
          </CardBody>
        </Card>
      )}

      {applications.length > 0 && (
        <Card>
          <CardHeader title="Application history" />
          <CardBody className="divide-y divide-border">
            {applications.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-ink">Rs. {Number(a.feeAmount).toFixed(2)}</p>
                  <p className="text-xs text-ink-muted">{new Date(a.createdAt).toLocaleString()}</p>
                  {a.decisionNotes && <p className="text-xs text-ink-muted">{a.decisionNotes}</p>}
                </div>
                <Badge tone={a.status === "approved" ? "success" : a.status === "rejected" ? "danger" : "warning"}>{a.status}</Badge>
              </div>
            ))}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
