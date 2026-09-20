"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DashCard, DashCardHeader } from "@/components/dashboard/ui/DashCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { Reveal } from "@/components/motion/Reveal";
import { adminApi, AdminApiError } from "@/lib/admin-api";

type TicketStatus = "open" | "resolved";

interface SupportTicket {
  id: string;
  subject: string;
  status: TicketStatus;
  slaDeadline: string;
  createdAt: string;
  store: { name: string };
}

const STATUS_FILTERS: { value: TicketStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
];

/**
 * SRS §5.6k/FR-8.18 (Module 90) - the admin-facing half of the ticket loop
 * sellers already got (Module 99's support-center: apps/web/app/support-center).
 * List only; the thread/reply/resolve UI lives on the detail page.
 */
export default function AdminSupportTicketsPage() {
  const [tickets, setTickets] = useState<SupportTicket[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "">("open");
  const [error, setError] = useState<string | null>(null);

  function load() {
    const query = statusFilter ? `?status=${statusFilter}` : "";
    adminApi
      .get<SupportTicket[]>(`/admin/support-tickets${query}`)
      .then(setTickets)
      .catch((err) => setError(err instanceof AdminApiError ? err.message : "Couldn't load support tickets."));
  }

  useEffect(load, [statusFilter]);

  function isPastDeadline(deadline: string, status: TicketStatus) {
    return status === "open" && new Date(deadline).getTime() < Date.now();
  }

  return (
    <div>
      <PageHeader
        title="Support tickets"
        description="Sellers' support requests, plain-text threads with a fixed SLA response-time commitment set at creation."
      />

      {error && <Alert tone="danger">{error}</Alert>}

      <DashCard className="mb-4">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f.value}
              variant={statusFilter === f.value ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setStatusFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </DashCard>

      {tickets === null ? (
        <PageSpinner />
      ) : tickets.length === 0 ? (
        <DashCard>
          <EmptyState title="No tickets" description="Support tickets across every store will show up here." />
        </DashCard>
      ) : (
        <DashCard className="overflow-hidden">
          <DashCardHeader title={`Tickets (${tickets.length})`} />
          <Reveal className="divide-y divide-border" stagger={0.03}>
            {tickets.map((t) => (
              <Link
                key={t.id}
                href={`/admin/support-tickets/${t.id}`}
                className="flex flex-wrap items-center justify-between gap-2 px-6 py-3 transition-smooth-fast hover:bg-canvas/60"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {t.subject} <span className="font-normal text-ink-muted">· {t.store.name}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">Opened {new Date(t.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  {isPastDeadline(t.slaDeadline, t.status) && <Badge tone="danger">Past SLA</Badge>}
                  <Badge tone={t.status === "open" ? "info" : "success"}>{t.status}</Badge>
                </div>
              </Link>
            ))}
          </Reveal>
        </DashCard>
      )}
    </div>
  );
}
