"use client";

import React, { useEffect, useState } from "react";
import { adminApi, AdminApiError } from "@/lib/admin-api";

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

/**
 * Module 25 P1 (SRS §5.33 FR-33.8) - Careers admin: job postings + the
 * applicant pipeline, API-only before this module. Applicant data (name,
 * email, phone, CV) never appears on any public endpoint - this page is
 * the only place it's ever rendered. Bare functional view (no design pass).
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
    try {
      await adminApi.post("/admin/careers/postings", { role, description });
      setRole("");
      setDescription("");
      loadPostings();
    } catch (err) {
      alert(err instanceof AdminApiError ? err.message : "Couldn't create this posting.");
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

  if (error) return <main>{error}</main>;
  if (!postings) return <main>Loading...</main>;

  return (
    <main>
      <h1>Careers (bare view - no design pass yet)</h1>
      <p>Manage job postings and review applicants. Applicant contact details/CV are never public - only shown here.</p>

      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>Role</th>
            <th>Status</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {postings.map((p) => (
            <React.Fragment key={p.id}>
              <tr>
                <td>{p.role}</td>
                <td>{p.status}</td>
                <td>{new Date(p.createdAt).toLocaleString()}</td>
                <td>
                  {POSTING_STATUSES.filter((s) => s !== p.status).map((s) => (
                    <button key={s} onClick={() => updatePostingStatus(p.id, s)}>
                      Set {s}
                    </button>
                  ))}{" "}
                  <button onClick={() => toggleApplications(p.id)}>
                    {expandedPostingId === p.id ? "Hide applicants" : "View applicants"}
                  </button>
                </td>
              </tr>
              {expandedPostingId === p.id && (
                <tr>
                  <td colSpan={4}>
                    {!applications ? (
                      "Loading applicants..."
                    ) : applications.length === 0 ? (
                      "No applicants yet."
                    ) : (
                      <table border={1} cellPadding={4}>
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>CV</th>
                            <th>Stage</th>
                            <th>Applied</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {applications.map((a) => (
                            <tr key={a.id}>
                              <td>{a.applicantName}</td>
                              <td>{a.applicantEmail}</td>
                              <td>{a.applicantPhone ?? "-"}</td>
                              <td>
                                <a href={a.cvUrl} target="_blank" rel="noreferrer">
                                  CV
                                </a>
                              </td>
                              <td>{a.statusLabel}</td>
                              <td>{new Date(a.createdAt).toLocaleString()}</td>
                              <td>
                                <select value={a.status} onChange={(e) => updateApplicationStatus(a.id, e.target.value as JobApplicationStatus)}>
                                  {APPLICATION_STATUSES.map((s) => (
                                    <option key={s} value={s}>
                                      {s}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>

      <h2>Create a new posting</h2>
      <form onSubmit={createPosting}>
        <p>
          <label>
            Role: <input value={role} onChange={(e) => setRole(e.target.value)} required />
          </label>
        </p>
        <p>
          <label>
            Description:
            <br />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} cols={60} required />
          </label>
        </p>
        <button type="submit">Create posting (draft)</button>
      </form>
    </main>
  );
}
