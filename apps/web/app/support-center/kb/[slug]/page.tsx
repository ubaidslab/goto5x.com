"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { PageSpinner } from "@/components/ui/Spinner";
import { api, ApiError } from "@/lib/dashboard-api";

interface ContentPage {
  slug: string;
  title: string;
  bodyHtml: string;
}

/** SRS FR-8.20 (Module 99, founder batch B17) - a knowledge-base article, rendered the same way any other content page already is (FR-12.1). */
export default function SupportCenterArticlePage({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const [page, setPage] = useState<ContentPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  // D82 - the access token lives in dashboard-api.ts's in-memory store now,
  // never localStorage; api.get() below handles "not logged in" on its own.
  useEffect(() => {
    api
      .get<ContentPage>(`/content-pages/${params.slug}`)
      .then(setPage)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        setError(err instanceof ApiError ? err.message : "Couldn't load this article.");
      });
  }, [params.slug, router]);

  return (
    <div>
      <Link href="/" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Back to Support Center
      </Link>

      {error && <p className="text-sm text-danger">{error}</p>}
      {!page && !error ? (
        <PageSpinner />
      ) : page ? (
        <Card>
          <CardBody>
            <h1 className="text-h3 text-ink">{page.title}</h1>
            <div className="prose prose-sm mt-4 max-w-none text-ink" dangerouslySetInnerHTML={{ __html: page.bodyHtml }} />
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
