"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { api, ApiError } from "@/lib/dashboard-api";

interface SupportTicket {
  id: string;
  subject: string;
  status: "open" | "resolved";
  slaDeadline: string;
  createdAt: string;
}

/** SRS FR-8.20 (Module 99, founder batch B17) - the seller-facing ticket list FR-8.18 always specified but never got a UI for, until now. */
export default function SupportCenterTicketsPage({ params }: { params: { storeId: string } }) {
  const router = useRouter();
  const [tickets, setTickets] = useState<SupportTicket[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!window.localStorage.getItem("accessToken")) {
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    api
      .get<SupportTicket[]>(`/stores/${params.storeId}/support-tickets`)
      .then(setTickets)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load your tickets."));
  }, [params.storeId]);

  return (
    <div>
      <Link href="/" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Back to Support Center
      </Link>

      <PageHeader
        title="Your support tickets"
        action={
          <Link href={`/stores/${params.storeId}/tickets/new`}>
            <Button>New ticket</Button>
          </Link>
        }
      />

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {!tickets ? (
        <PageSpinner />
      ) : (
        <Card>
          <CardHeader title="All tickets" />
          <CardBody className="px-0 py-0">
            {tickets.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-ink-muted">No tickets yet. Raise one if a knowledge-base article doesn't answer your question.</p>
            ) : (
              <ul className="divide-y divide-border">
                {tickets.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/stores/${params.storeId}/tickets/${t.id}`}
                      className="flex items-center justify-between gap-4 px-6 py-3.5 transition-smooth-fast hover:bg-canvas"
                    >
                      <span className="text-sm font-medium text-ink">{t.subject}</span>
                      <Badge tone={t.status === "open" ? "info" : "success"} dot>
                        {t.status === "open" ? "Open" : "Resolved"}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
