"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ApiError, api } from "@/lib/dashboard-api";

type ImportJobType = "product_import" | "product_export" | "order_export";
type ImportJobStatus = "pending" | "processing" | "completed" | "failed";

interface RowError {
  row: number;
  message: string;
}

interface ImportJob {
  id: string;
  type: ImportJobType;
  status: ImportJobStatus;
  fileUrl: string;
  unmappedFields: string[];
  errorLog: RowError[] | null;
  createdAt: string;
  completedAt: string | null;
}

const statusTone: Record<ImportJobStatus, "neutral" | "success" | "warning" | "danger" | "info"> = {
  pending: "warning",
  processing: "info",
  completed: "success",
  failed: "danger",
};

export default function DataPortabilityPage({ params }: { params: { storeId: string } }) {
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState<"products" | "orders" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function loadJobs() {
    api
      .get<ImportJob[]>(`/stores/${params.storeId}/import-jobs`)
      .then(setJobs)
      .catch(() => setJobs([]));
  }

  useEffect(loadJobs, [params.storeId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.upload(`/stores/${params.storeId}/import-jobs`, formData);
      loadJobs();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't upload that file.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function runExport(kind: "products" | "orders") {
    setError(null);
    setExporting(kind);
    try {
      const result = await api.post<{ fileUrl: string }>(`/stores/${params.storeId}/exports/${kind}`);
      window.open(result.fileUrl, "_blank");
      loadJobs();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't generate that export.");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div>
      <PageHeader title="Import & export" description="Bring products in from another platform, or take your own data out." />

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      <div className="max-w-3xl space-y-6">
        <Card>
          <CardHeader
            title="Import products"
            description="A Shopify product-export CSV. Core fields only - title, description, price, variants/options, images, and inventory."
          />
          <CardBody>
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleUpload} className="hidden" id="import-csv-input" />
            <Button variant="secondary" loading={uploading} onClick={() => fileInputRef.current?.click()}>
              Upload CSV
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Export your data" description="For your own records, or to move to another platform." />
          <CardBody className="flex gap-3">
            <Button variant="secondary" loading={exporting === "products"} onClick={() => runExport("products")}>
              Export products
            </Button>
            <Button variant="secondary" loading={exporting === "orders"} onClick={() => runExport("orders")}>
              Export orders
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Recent jobs" />
          {jobs.length === 0 ? (
            <CardBody className="text-sm text-ink-muted">Nothing yet.</CardBody>
          ) : (
            <div className="divide-y divide-border">
              {jobs.map((job) => (
                <div key={job.id} className="px-6 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-ink">
                        {job.type === "product_import" ? "Product import" : job.type === "product_export" ? "Product export" : "Order export"}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-muted">{new Date(job.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {job.status === "completed" && (
                        <a href={job.fileUrl} target="_blank" rel="noreferrer" className="text-sm text-accent hover:underline">
                          {job.type === "product_import" ? "View source file" : "Download"}
                        </a>
                      )}
                      <Badge tone={statusTone[job.status]}>{job.status}</Badge>
                    </div>
                  </div>
                  {job.unmappedFields.length > 0 && (
                    <p className="mt-2 text-xs text-ink-muted">
                      Not mapped: {job.unmappedFields.join(", ")}
                    </p>
                  )}
                  {job.errorLog && job.errorLog.length > 0 && (
                    <div className="mt-2 space-y-1 text-xs text-danger">
                      {job.errorLog.map((rowError, i) => (
                        <p key={i}>{rowError.message}</p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
