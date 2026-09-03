"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CardHeader, Card, CardBody } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { api, ApiError } from "@/lib/dashboard-api";

const KB_SLUG_PREFIX = "support-kb-";

interface StoreSummary {
  id: string;
  name: string;
}

interface ContentPageSummary {
  slug: string;
  title: string;
}

/**
 * SRS FR-8.20 (Module 99, founder batch B17) - the Support Center's home:
 * a store picker into that store's own ticket thread (tickets are
 * store-scoped, matching FR-8.18's existing model), plus the self-service
 * knowledge-base articles - content pages under the support-kb- prefix
 * (FR-12.1's existing system, no new content model).
 */
export default function SupportCenterHomePage() {
  const router = useRouter();
  const [stores, setStores] = useState<StoreSummary[] | null>(null);
  const [articles, setArticles] = useState<ContentPageSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!window.localStorage.getItem("accessToken")) {
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    api
      .get<StoreSummary[]>("/stores")
      .then(setStores)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        setError(err instanceof ApiError ? err.message : "Couldn't load your stores.");
      });
  }, [router]);

  useEffect(() => {
    api
      .get<ContentPageSummary[]>("/content-pages")
      .then((pages) => setArticles(pages.filter((p) => p.slug.startsWith(KB_SLUG_PREFIX))))
      .catch(() => setArticles([]));
  }, []);

  if (!stores || !articles) return <PageSpinner />;

  return (
    <div>
      <PageHeader title="Support Center" description="Browse help articles, or submit a request and we'll get back to you within your plan's response-time commitment." />

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      <div className="space-y-6">
        <Card>
          <CardHeader title="Knowledge base" description="Common questions, answered." />
          <CardBody>
            {articles.length === 0 ? (
              <p className="text-sm text-ink-muted">No articles yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {articles.map((a) => (
                  <li key={a.slug} className="py-2.5">
                    <Link href={`/kb/${a.slug}`} className="text-sm font-medium text-accent hover:underline">
                      {a.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Submit a ticket" description="Didn't find your answer above? Raise a ticket for one of your stores." />
          <CardBody>
            {stores.length === 0 ? (
              <p className="text-sm text-ink-muted">You don't have any stores yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {stores.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-4 py-2.5">
                    <span className="text-sm text-ink">{s.name}</span>
                    <Link href={`/stores/${s.id}/tickets`} className="text-sm font-medium text-accent hover:underline">
                      View tickets
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
