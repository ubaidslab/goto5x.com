"use client";

import { Briefcase } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { SectionTitle } from "@/components/marketing/SectionTitle";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/Dialog";
import { Reveal } from "@/components/motion/Reveal";

interface JobPosting {
  id: string;
  role: string;
  description: string;
}

const inputClass =
  "h-10 w-full rounded-md border border-border bg-canvas px-3 text-sm text-ink placeholder:text-ink-faint " +
  "transition-smooth-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

/** SRS §5.33 FR-33.8 - the public listing (GET /careers, no auth) + the apply-with-CV flow against the real backend. */
export default function CareersPage() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const [postings, setPostings] = useState<JobPosting[] | null>(null);

  useEffect(() => {
    fetch(`${apiBase}/careers`)
      .then((r) => r.json())
      .then(setPostings)
      .catch(() => setPostings([]));
  }, [apiBase]);

  return (
    <div className="min-h-screen bg-canvas">
      <MarketingNav />

      <section className="pb-24 pt-40 sm:pt-48">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <Reveal>
            <p className="text-eyebrow uppercase text-accent">Careers</p>
            <h1 className="mt-6 font-display text-display text-ink">Come build it with us.</h1>
            <p className="mt-6 text-body-lg text-ink-muted">
              We&apos;re a small team building the commerce platform Pakistan&apos;s sellers deserve.
              Open roles are listed below - apply directly, no recruiter in between.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="border-t border-border py-24">
        <div className="mx-auto max-w-3xl px-6">
          <SectionTitle eyebrow="Open roles" title="Current openings." />

          {postings === null && <p className="mt-16 text-center text-sm text-ink-faint">Loading open roles…</p>}

          {postings !== null && postings.length === 0 && (
            <Reveal className="mt-16 rounded-2xl border border-border bg-surface p-10 text-center">
              <Briefcase className="mx-auto h-8 w-8 text-ink-faint" strokeWidth={1.5} aria-hidden />
              <p className="mt-4 text-body text-ink-muted">
                No open roles right now - check back soon, or reach out anyway if you think you&apos;d
                be a great fit.
              </p>
            </Reveal>
          )}

          {postings !== null && postings.length > 0 && (
            <Reveal stagger={0.1} className="mt-16 space-y-4">
              {postings.map((posting) => (
                <JobPostingRow key={posting.id} posting={posting} apiBase={apiBase} />
              ))}
            </Reveal>
          )}
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

function JobPostingRow({ posting, apiBase }: { posting: JobPosting; apiBase?: string }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 shadow-xs sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 className="font-display text-h4 font-bold text-ink">{posting.role}</h3>
        <p className="mt-2 text-sm text-ink-muted">{posting.description}</p>
      </div>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="primary" className="shrink-0">
            Apply
          </Button>
        </DialogTrigger>
        <ApplyDialogContent posting={posting} apiBase={apiBase} />
      </Dialog>
    </div>
  );
}

function ApplyDialogContent({ posting, apiBase }: { posting: JobPosting; apiBase?: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cv, setCv] = useState<File | null>(null);
  const [status, setStatus] = useState<{ kind: "error" | "success"; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!cv) {
      setStatus({ kind: "error", message: "Attach your CV (PDF or Word document) before submitting." });
      return;
    }
    setSubmitting(true);
    setStatus(null);

    const form = new FormData();
    form.append("applicantName", name);
    form.append("applicantEmail", email);
    if (phone) form.append("applicantPhone", phone);
    form.append("cv", cv);

    try {
      const res = await fetch(`${apiBase}/careers/${posting.id}/apply`, { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ kind: "error", message: body.message ?? "Something went wrong - please try again." });
      } else {
        setStatus({ kind: "success", message: "Application received - we'll be in touch by email." });
      }
    } catch {
      setStatus({ kind: "error", message: "Something went wrong - please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  if (status?.kind === "success") {
    return (
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply for {posting.role}</DialogTitle>
        </DialogHeader>
        <p className="text-body text-ink-muted">{status.message}</p>
      </DialogContent>
    );
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Apply for {posting.role}</DialogTitle>
        <DialogDescription>We&apos;ll only use these details to review your application.</DialogDescription>
      </DialogHeader>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-ink" htmlFor="applicantName">
            Full name
          </label>
          <input
            id="applicantName"
            className={`mt-1.5 ${inputClass}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-ink" htmlFor="applicantEmail">
            Email
          </label>
          <input
            id="applicantEmail"
            type="email"
            className={`mt-1.5 ${inputClass}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium text-ink" htmlFor="applicantPhone">
            Phone <span className="text-ink-faint">(optional)</span>
          </label>
          <input id="applicantPhone" className={`mt-1.5 ${inputClass}`} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium text-ink" htmlFor="applicantCv">
            CV <span className="text-ink-faint">(PDF or Word, up to 5MB)</span>
          </label>
          <input
            id="applicantCv"
            type="file"
            accept=".pdf,.doc,.docx"
            className="mt-1.5 block w-full text-sm text-ink-muted file:mr-3 file:h-9 file:rounded-md file:border file:border-border file:bg-canvas file:px-3 file:text-sm file:font-medium file:text-ink"
            onChange={(e) => setCv(e.target.files?.[0] ?? null)}
            required
          />
        </div>
        {status?.kind === "error" && <p className="text-sm text-danger">{status.message}</p>}
        <Button type="submit" variant="primary" className="w-full" loading={submitting}>
          Submit application
        </Button>
      </form>
    </DialogContent>
  );
}
