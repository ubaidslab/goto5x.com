"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DashCard, DashCardHeader } from "@/components/dashboard/ui/DashCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { Reveal } from "@/components/motion/Reveal";
import { ApiError, api } from "@/lib/dashboard-api";

type ProgramType = "ambassador" | "student_referral" | "creator";
type ParticipantStatus = "pending" | "approved" | "rejected" | "suspended" | "terminated";
type ContentPlatform = "tiktok" | "instagram" | "youtube" | "snapchat" | "facebook" | "x" | "pinterest";
type ContentStatus = "pending" | "verified" | "rejected";
type PayoutStatus = "requested" | "approved" | "processing" | "paid" | "rejected";

interface ProgramParticipant {
  id: string;
  programType: ProgramType;
  status: ParticipantStatus;
  referralCode: string | null;
  appliedAt: string;
  decisionNotes: string | null;
  freeStoreSlotsGranted: number | null;
}

interface CertificateTier {
  tierName: string | null;
  lifetimeReferredPaidCount: number;
}

interface ContentSubmission {
  id: string;
  platform: ContentPlatform;
  contentUrl: string;
  reportedViews: number;
  status: ContentStatus;
  rewardAmount: string | null;
  notes: string | null;
  createdAt: string;
}

interface PayoutRequest {
  id: string;
  amount: string;
  currency: string;
  status: PayoutStatus;
  requestedAt: string;
  decisionNotes: string | null;
  paymentReference: string | null;
}

const PROGRAM_LABELS: Record<ProgramType, string> = {
  ambassador: "Ambassador",
  student_referral: "Student Referral",
  creator: "Creator",
};

const PROGRAM_DESCRIPTIONS: Record<ProgramType, string> = {
  ambassador: "Refer 12+ paid store subscriptions in a calendar month and get that month's plan fee credited back. Reach higher lifetime referral tiers for a certificate.",
  student_referral: "Refer new sellers to uzeyn.com and earn a commission on their subscriptions.",
  creator: "Post content about uzeyn.com and earn rewards for verified views, up to a monthly cap.",
};

const PARTICIPANT_STATUS_TONE: Record<ParticipantStatus, "success" | "warning" | "danger" | "neutral"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  suspended: "danger",
  terminated: "danger",
};

const CONTENT_STATUS_TONE: Record<ContentStatus, "success" | "warning" | "danger"> = {
  pending: "warning",
  verified: "success",
  rejected: "danger",
};

const PAYOUT_STATUS_TONE: Record<PayoutStatus, "success" | "warning" | "danger" | "info"> = {
  requested: "warning",
  approved: "info",
  processing: "info",
  paid: "success",
  rejected: "danger",
};

const PLATFORMS: ContentPlatform[] = ["tiktok", "instagram", "youtube", "snapchat", "facebook", "x", "pinterest"];
const PROGRAM_TYPES: ProgramType[] = ["ambassador", "student_referral", "creator"];

/**
 * FR-33.2/33.5/33.6/33.7/33.9 - the seller-facing side of Growth Programs
 * (Ambassador/Student Referral/Creator). The admin queues
 * (admin/growth-programs/*) have existed since Module 22; a seller could
 * apply/submit/withdraw via raw API calls only - there was never a
 * frontend screen for it. Reachable from the Billing & plan page (not a
 * new top-level nav slot - the seller nav's four groups are founder-
 * locked "no more, no less", per nav-items.ts's own doc comment).
 */
export default function GrowthProgramsPage() {
  const [loaded, setLoaded] = useState(false);
  const [participants, setParticipants] = useState<ProgramParticipant[]>([]);
  const [certificateTier, setCertificateTier] = useState<CertificateTier | null>(null);
  const [submissions, setSubmissions] = useState<ContentSubmission[]>([]);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [applyingType, setApplyingType] = useState<ProgramType | null>(null);

  const [platform, setPlatform] = useState<ContentPlatform>("tiktok");
  const [contentUrl, setContentUrl] = useState("");
  const [reportedViews, setReportedViews] = useState("");
  const [submittingContent, setSubmittingContent] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);

  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [requestingWithdrawal, setRequestingWithdrawal] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  function loadAll() {
    api.get<ProgramParticipant[]>("/sellers/me/growth-programs/applications").then(setParticipants).catch(() => {});
    api.get<CertificateTier>("/sellers/me/growth-programs/ambassador/certificate-tier").then(setCertificateTier).catch(() => {});
    api.get<ContentSubmission[]>("/sellers/me/growth-programs/content").then(setSubmissions).catch(() => {});
    api
      .get<PayoutRequest[]>("/sellers/me/growth-programs/withdrawals")
      .then(setPayouts)
      .catch(() => {})
      .finally(() => setLoaded(true));
    api.get<{ balance: number }>("/sellers/me/wallet").then((w) => setBalance(w.balance)).catch(() => {});
  }

  useEffect(loadAll, []);

  async function apply(programType: ProgramType) {
    setError(null);
    setApplyingType(programType);
    try {
      await api.post("/sellers/me/growth-programs/applications", { programType });
      loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't submit that application.");
    } finally {
      setApplyingType(null);
    }
  }

  async function submitContent(e: React.FormEvent) {
    e.preventDefault();
    setContentError(null);
    setSubmittingContent(true);
    try {
      await api.post("/sellers/me/growth-programs/content", {
        platform,
        contentUrl,
        reportedViews: Number(reportedViews),
      });
      setContentUrl("");
      setReportedViews("");
      loadAll();
    } catch (err) {
      setContentError(err instanceof ApiError ? err.message : "Couldn't submit that content link.");
    } finally {
      setSubmittingContent(false);
    }
  }

  async function requestWithdrawal(e: React.FormEvent) {
    e.preventDefault();
    setWithdrawError(null);
    setRequestingWithdrawal(true);
    try {
      await api.post("/sellers/me/growth-programs/withdrawals", { amount: Number(withdrawAmount) });
      setWithdrawAmount("");
      loadAll();
    } catch (err) {
      setWithdrawError(err instanceof ApiError ? err.message : "Couldn't submit that withdrawal request.");
    } finally {
      setRequestingWithdrawal(false);
    }
  }

  function copyReferralLink(code: string) {
    const link = `${window.location.origin}/signup?ref=${code}`;
    navigator.clipboard.writeText(link).catch(() => {});
  }

  if (!loaded) return <PageSpinner />;

  const byType = new Map(participants.map((p) => [p.programType, p]));
  const approvedCreator = byType.get("creator")?.status === "approved";
  const hasOutstandingWithdrawal = payouts.some((p) => p.status === "requested" || p.status === "approved" || p.status === "processing");
  const hasAnyApprovedProgram = participants.some((p) => p.status === "approved");

  return (
    <div>
      <PageHeader
        title="Growth Programs"
        description="Ambassador, Student Referral, and Creator programs - apply, track your rewards, and request payouts."
      />
      {error && <Alert tone="danger">{error}</Alert>}

      <div className="max-w-4xl space-y-6">
        <Reveal>
          <DashCard>
            <DashCardHeader title="Your programs" />
            <div className="divide-y divide-border">
              {PROGRAM_TYPES.map((type) => {
                const participant = byType.get(type);
                return (
                  <div key={type} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-ink">{PROGRAM_LABELS[type]}</p>
                        <p className="mt-0.5 text-xs text-ink-muted">{PROGRAM_DESCRIPTIONS[type]}</p>
                      </div>
                      {participant ? (
                        <Badge tone={PARTICIPANT_STATUS_TONE[participant.status]}>{participant.status}</Badge>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => apply(type)} loading={applyingType === type}>
                          Apply
                        </Button>
                      )}
                    </div>

                    {participant?.status === "approved" && participant.referralCode && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-border bg-canvas p-3">
                        <span className="text-xs text-ink-muted">Your referral link</span>
                        <code className="rounded bg-surface px-2 py-1 text-xs text-ink">
                          {typeof window !== "undefined" ? window.location.origin : ""}/signup?ref={participant.referralCode}
                        </code>
                        <Button size="sm" variant="ghost" onClick={() => copyReferralLink(participant.referralCode!)}>
                          Copy
                        </Button>
                      </div>
                    )}

                    {participant?.status === "approved" && type === "ambassador" && (
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                        <div>
                          <p className="text-xs text-ink-faint">Certificate tier</p>
                          <p className="font-medium text-ink">{certificateTier?.tierName ?? "None yet"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-ink-faint">Lifetime referred (paid)</p>
                          <p className="font-medium text-ink">{certificateTier?.lifetimeReferredPaidCount ?? 0}</p>
                        </div>
                        {participant.freeStoreSlotsGranted != null && (
                          <div>
                            <p className="text-xs text-ink-faint">Free store slots</p>
                            <p className="font-medium text-ink">{participant.freeStoreSlotsGranted}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {(participant?.status === "rejected" || participant?.status === "suspended" || participant?.status === "terminated") &&
                      participant.decisionNotes && <p className="mt-2 text-xs text-ink-muted">Note: {participant.decisionNotes}</p>}
                  </div>
                );
              })}
            </div>
          </DashCard>
        </Reveal>

        <Reveal>
          <DashCard>
            <DashCardHeader
              title="Creator content submissions"
              description="Submit a link to content you've posted about uzeyn.com - rewards are computed and paid only after admin verification."
            />
            <div className="space-y-4">
              {!byType.has("creator") ? (
                <p className="text-sm text-ink-muted">Apply to the Creator program above to submit content.</p>
              ) : approvedCreator ? (
                <form onSubmit={submitContent} className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end">
                  {contentError && (
                    <div className="sm:col-span-4">
                      <Alert tone="danger">{contentError}</Alert>
                    </div>
                  )}
                  <Field label="Platform">
                    <Select value={platform} onChange={(e) => setPlatform(e.target.value as ContentPlatform)}>
                      {PLATFORMS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Content URL">
                      <Input type="url" value={contentUrl} onChange={(e) => setContentUrl(e.target.value)} required maxLength={2000} />
                    </Field>
                  </div>
                  <Field label="Reported views">
                    <Input type="number" min={0} value={reportedViews} onChange={(e) => setReportedViews(e.target.value)} required />
                  </Field>
                  <div className="sm:col-span-4">
                    <Button type="submit" size="sm" loading={submittingContent}>
                      Submit
                    </Button>
                  </div>
                </form>
              ) : (
                <p className="text-sm text-ink-muted">Your Creator application is {byType.get("creator")?.status} - submissions open once it's approved.</p>
              )}

              {submissions.length === 0 ? (
                <EmptyState title="No submissions yet" description="Content you submit will show up here with its verification status." />
              ) : (
                <div className="divide-y divide-border border-t border-border pt-3">
                  {submissions.map((s) => (
                    <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                      <div>
                        <p className="font-medium capitalize text-ink">
                          {s.platform} <span className="font-normal text-ink-muted">- {s.reportedViews.toLocaleString()} views reported</span>
                        </p>
                        <p className="text-xs text-ink-muted">{new Date(s.createdAt).toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {s.rewardAmount != null && <span className="text-xs text-ink-muted">Rs. {Number(s.rewardAmount).toFixed(2)}</span>}
                        <Badge tone={CONTENT_STATUS_TONE[s.status]}>{s.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DashCard>
        </Reveal>

        <Reveal>
          <DashCard>
            <DashCardHeader title="Withdrawals" description="Withdraw your Growth Programs reward balance to your registered payment instrument." />
            <div className="space-y-4">
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs text-ink-faint">Wallet balance</p>
                <p className="text-2xl font-semibold text-ink">Rs. {(balance ?? 0).toFixed(2)}</p>
              </div>

              {!hasAnyApprovedProgram ? (
                <p className="text-sm text-ink-muted">Only an approved program participant can request a withdrawal.</p>
              ) : hasOutstandingWithdrawal ? (
                <p className="text-sm text-ink-muted">You already have an outstanding withdrawal request - wait for it to be resolved before requesting another.</p>
              ) : (
                <form onSubmit={requestWithdrawal} className="flex items-end gap-2">
                  {withdrawError && (
                    <div className="w-full">
                      <Alert tone="danger">{withdrawError}</Alert>
                    </div>
                  )}
                  <div className="flex-1">
                    <Field label="Amount">
                      <Input type="number" step="0.01" min="0.01" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} required />
                    </Field>
                  </div>
                  <Button type="submit" loading={requestingWithdrawal}>
                    Request withdrawal
                  </Button>
                </form>
              )}

              {payouts.length > 0 && (
                <div className="divide-y divide-border border-t border-border pt-3">
                  {payouts.map((p) => (
                    <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                      <div>
                        <p className="font-medium text-ink">
                          {p.currency} {Number(p.amount).toFixed(2)}
                        </p>
                        <p className="text-xs text-ink-muted">
                          {new Date(p.requestedAt).toLocaleString()}
                          {p.paymentReference && ` - ref: ${p.paymentReference}`}
                        </p>
                      </div>
                      <Badge tone={PAYOUT_STATUS_TONE[p.status]}>{p.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DashCard>
        </Reveal>
      </div>
    </div>
  );
}
