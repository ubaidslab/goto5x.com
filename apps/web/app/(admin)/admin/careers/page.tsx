"use client";

import { useEffect, useState } from "react";
import { adminApi, AdminApiError } from "@/lib/admin-api";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DashCard, DashCardHeader } from "@/components/dashboard/ui/DashCard";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";

type JobPostingStatus = "draft" | "open" | "closed";
type JobApplicationStatus = "received" | "reviewing" | "interviewing" | "rejected" | "hired";

interface JobPosting {
  id: string;
  role: string;
  description: string;
  status: JobPostingStatus;
  createdAt: string;
}

interface JobApplication {
  id: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string | null;
  cvUrl: string;
  status: JobApplicationStatus;
  statusLabel: string;
  createdAt: string;
}

const POSTING_STATUSES: JobPostingStatus[] = ["draft", "open", "closed"];
const APPLICATION_STATUSES: JobApplicationStatus[] = ["received", "reviewing", "interviewing", "rejected", "hired"];
const postingTone: Record<JobPostingStatus, "neutral" | "success" | "warning"> = { draft: "neutral", open: "success", closed: "warning" };

/**
 * Phase 6e (Admin Terminal re-skin) - SRS §5.33/FR-33.8's Careers admin
 * (job postings + applicant pipeline), restyled onto DashCard. Every
 * action preserved: create posting, set posting status, expand/collapse
 * applicants, per-applicant stage select. Applicant contact/CV still only
 * ever rendered here.
 */
export default function AdminCareersPage() {
  const [postings, setPostings] = useState<JobPosting[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState("");
  const [description, setDescription] = useState("");
  const [expandedPostingId, setExpandedPostingId] = useState<string | null>(null);
  const [applications, setApplications] = useState<JobApplication[] | null>(null);

  function loadPostings() {
    adminApi
      .get<JobPosting[]>("/admin/careers/postings")
      .then(setPostings)
      .catch((err) => setError(err instanceof AdminApiError ? err.message : "Couldn't load job postings."));
  }

  useEffect(loadPostings, []);

  async function createPosting(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await adminApi.post("/admin/careers/postings", { role, description });
      setRole("");
      setDescription("");
      loadPostings();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Couldn't create this posting.");
    }
  }

  async function updatePostingStatus(postingId: string, status: JobPostingStatus) {
    await adminApi.patch(`/admin/careers/postings/${postingId}/status`, { status });
    loadPostings();
  }

  function toggleApplications(postingId: string) {
    if (expandedPostingId === postingId) {
      setExpandedPostingId(null);
      setApplications(null);
      return;
    }
    setExpandedPostingId(postingId);
    setApplications(null);
    adminApi.get<JobApplication[]>(`/admin/careers/postings/${postingId}/applications`).then(setApplications);
  }

  async function updateApplicationStatus(applicationId: string, status: JobApplicationStatus) {
    await adminApi.patch(`/admin/careers/applications/${applicationId}/status`, { status });
    if (expandedPostingId) {
      adminApi.get<JobApplication[]>(`/admin/careers/postings/${expandedPostingId}/applications`).then(setApplications);
    }
  }

  if (error && !postings) return <Alert tone="danger">{error}</Alert>;
  if (!postings) return <PageSpinner />;

  return (
    <div>
      <PageHeader title="Careers" description="Manage job postings and review applicants. Applicant contact details/CV are never public - only shown here." />

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="max-w-3xl space-y-4">
        <DashCard className="divide-y divide-border">
          {postings.map((p) => (
            <div key={p.id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-ink">{p.role}</p>
                  <p className="text-xs text-ink-muted">Created {new Date(p.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={postingTone[p.status]}>{p.status}</Badge>
                  {POSTING_STATUSES.filter((s) => s !== p.status).map((s) => (
                    <Button key={s} variant="ghost" size="sm" onClick={() => updatePostingStatus(p.id, s)}>
                      Set {s}
                    </Button>
                  ))}
                  <Button variant="secondary" size="sm" onClick={() => toggleApplications(p.id)}>
                    {expandedPostingId === p.id ? "Hide applicants" : "View applicants"}
                  </Button>
                </div>
              </div>
              {expandedPostingId === p.id && (
                <div className="mt-3 rounded-md border border-border bg-canvas p-3">
                  {!applications ? (
                    <PageSpinner />
                  ) : applications.length === 0 ? (
                    <p className="text-sm text-ink-muted">No applicants yet.</p>
                  ) : (
                    <div className="divide-y divide-border">
                      {applications.map((a) => (
                        <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                          <div>
                            <p className="font-medium text-ink">{a.applicantName}</p>
                            <p className="text-xs text-ink-muted">
                              {a.applicantEmail} {a.applicantPhone && `· ${a.applicantPhone}`} ·{" "}
                              <a href={a.cvUrl} target="_blank" rel="noreferrer" className="text-accent hover:opacity-80">
                                CV
                              </a>{" "}
                              · applied {new Date(a.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <Select value={a.status} onChange={(e) => updateApplicationStatus(a.id, e.target.value as JobApplicationStatus)} className="w-40">
                            {APPLICATION_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </Select>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </DashCard>

        <DashCard>
          <DashCardHeader title="Create a new posting" />
          <form onSubmit={createPosting} className="space-y-3">
            <Field label="Role">
              <Input value={role} onChange={(e) => setRole(e.target.value)} required />
            </Field>
            <Field label="Description">
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} required />
            </Field>
            <Button type="submit">Create posting (draft)</Button>
          </form>
        </DashCard>
      </div>
    </div>
  );
}
