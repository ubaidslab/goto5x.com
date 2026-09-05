"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/Button";
import { Card, CardBody, CardHeader } from "../ui/Card";
import { Disclosure } from "../ui/Disclosure";
import { EmptyState } from "../ui/EmptyState";
import { Alert } from "../ui/Alert";
import { ApiError, api } from "../../lib/dashboard-api";

interface MediaAsset {
  id: string;
  url: string;
  type: "image" | "video";
  productId: string | null;
  sortOrder: number;
  isPrimary: boolean;
  /** FR-66.7 (Module 87) - a seller-chosen poster image, only meaningful when type is "video". */
  thumbnailMedia: { id: string; url: string } | null;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

interface DriveConnection {
  googleAccountEmail: string;
  status: string;
}

/**
 * Product images: upload, Google Drive import, attach/detach an existing
 * store-level asset, reorder, and set a primary image. Owns its own data -
 * one fetch of the store's whole media pool covers both this product's
 * attached images and the "attach an existing upload" picker, so the
 * product edit page doesn't need to know about media at all.
 */
export function ImagesSection({ storeId, productId }: { storeId: string; productId: string }) {
  const [images, setImages] = useState<MediaAsset[]>([]);
  const [unattached, setUnattached] = useState<MediaAsset[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [driveConnection, setDriveConnection] = useState<DriveConnection | null | undefined>(undefined);
  const [driveFiles, setDriveFiles] = useState<DriveFile[] | null>(null);
  const [selectedDriveIds, setSelectedDriveIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  function load() {
    api
      .get<MediaAsset[]>(`/stores/${storeId}/media`)
      .then((all) => {
        setImages(all.filter((asset) => asset.productId === productId).sort((a, b) => a.sortOrder - b.sortOrder));
        setUnattached(all.filter((asset) => !asset.productId));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }

  useEffect(load, [storeId, productId]);

  useEffect(() => {
    api
      .get<DriveConnection | null>("/media/drive/connection")
      .then(setDriveConnection)
      .catch(() => setDriveConnection(null));
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("productId", productId);
      const asset = await api.upload<MediaAsset>(`/stores/${storeId}/media`, form);
      setImages((prev) => [...prev, asset]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't upload that file.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function connectDrive() {
    try {
      const { authUrl } = await api.get<{ authUrl: string }>("/media/drive/connect");
      window.open(authUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't start the Google Drive connection.");
    }
  }

  function loadDriveFiles() {
    setError(null);
    api
      .get<DriveFile[]>("/media/drive/files")
      .then(setDriveFiles)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't list Drive files."));
  }

  function toggleDriveFile(id: string) {
    setSelectedDriveIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function importSelected() {
    if (selectedDriveIds.size === 0) return;
    setError(null);
    setImporting(true);
    try {
      await api.post(`/media/drive/stores/${storeId}/import`, { fileIds: Array.from(selectedDriveIds) });
      setSelectedDriveIds(new Set());
      setDriveFiles(null);
      load(); // imported files land unattached - same as any other upload, attach below
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't import the selected files.");
    } finally {
      setImporting(false);
    }
  }

  async function attach(assetId: string) {
    setError(null);
    try {
      const asset = await api.patch<MediaAsset>(`/stores/${storeId}/media/${assetId}`, { productId });
      setImages((prev) => [...prev, asset]);
      setUnattached((prev) => prev.filter((a) => a.id !== assetId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't attach that image.");
    }
  }

  async function detach(assetId: string) {
    setError(null);
    try {
      const asset = await api.patch<MediaAsset>(`/stores/${storeId}/media/${assetId}`, { productId: null });
      setImages((prev) => prev.filter((img) => img.id !== assetId));
      setUnattached((prev) => [...prev, asset]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't remove that image.");
    }
  }

  async function setPrimary(assetId: string) {
    setError(null);
    try {
      await api.patch(`/stores/${storeId}/media/${assetId}/primary`);
      setImages((prev) => prev.map((img) => ({ ...img, isPrimary: img.id === assetId })));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't set that image as primary.");
    }
  }

  /** FR-66.7 (Module 87) - `thumbnailMediaId: null` clears the poster image. */
  async function setThumbnail(assetId: string, thumbnailMediaId: string | null) {
    setError(null);
    try {
      const asset = await api.patch<MediaAsset>(`/stores/${storeId}/media/${assetId}/thumbnail`, { thumbnailMediaId });
      setImages((prev) => prev.map((img) => (img.id === assetId ? asset : img)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't set that thumbnail.");
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const previous = images;
    const reordered = [...images];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setImages(reordered); // optimistic - confirmed by the persisted response below
    setError(null);
    try {
      const saved = await api.patch<MediaAsset[]>(`/stores/${storeId}/media/reorder`, {
        productId,
        mediaIds: reordered.map((img) => img.id),
      });
      setImages(saved);
    } catch (err) {
      setImages(previous);
      setError(err instanceof ApiError ? err.message : "Couldn't save that order.");
    }
  }

  return (
    <Card>
      <CardHeader title="Images" description="Shown to buyers on the product page, in this order." />
      <CardBody className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        {loaded && images.length === 0 ? (
          <EmptyState title="No images yet" description="Upload a photo, or import one from Google Drive below." />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map((image, index) => (
              <div key={image.id} className="overflow-hidden rounded-md border border-border bg-canvas">
                <div className="relative aspect-square">
                  {image.type === "video" ? (
                    <video
                      src={image.url}
                      poster={image.thumbnailMedia?.url}
                      muted
                      preload="metadata"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element -- seller-uploaded external MinIO URLs, not a static/local asset
                    <img src={image.url} alt="" className="h-full w-full object-cover" />
                  )}
                  {image.isPrimary && (
                    <span className="absolute left-2 top-2 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-on-accent">
                      Primary
                    </span>
                  )}
                </div>
                {image.type === "video" && (
                  <label className="flex items-center gap-1 border-t border-border p-2 text-xs text-ink-muted">
                    Thumbnail
                    <select
                      value={image.thumbnailMedia?.id ?? ""}
                      onChange={(e) => setThumbnail(image.id, e.target.value || null)}
                      className="flex-1 rounded border border-border bg-canvas px-1 py-0.5 text-xs text-ink"
                    >
                      <option value="">None</option>
                      {images
                        .filter((candidate) => candidate.type === "image")
                        .map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.isPrimary ? "Primary image" : `Image ${images.indexOf(candidate) + 1}`}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                <div className="flex items-center justify-between gap-1 p-2">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      className="rounded px-1.5 py-0.5 text-xs text-ink-muted transition-smooth-fast hover:bg-surface-raised disabled:opacity-30"
                      aria-label="Move earlier"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={index === images.length - 1}
                      className="rounded px-1.5 py-0.5 text-xs text-ink-muted transition-smooth-fast hover:bg-surface-raised disabled:opacity-30"
                      aria-label="Move later"
                    >
                      ↓
                    </button>
                  </div>
                  <div className="flex gap-1">
                    {!image.isPrimary && (
                      <button
                        type="button"
                        onClick={() => setPrimary(image.id)}
                        className="rounded px-1.5 py-0.5 text-xs text-ink-muted transition-smooth-fast hover:bg-surface-raised"
                      >
                        Set primary
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => detach(image.id)}
                      className="rounded px-1.5 py-0.5 text-xs text-danger transition-smooth-fast hover:bg-danger-subtle"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleUpload}
            className="hidden"
            id={`media-upload-input-${productId}`}
          />
          <Button type="button" variant="secondary" loading={uploading} onClick={() => fileInputRef.current?.click()}>
            Upload image or video
          </Button>
        </div>

        {unattached.length > 0 && (
          <Disclosure label={`Store media not on this product (${unattached.length})`}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {unattached.map((asset) => (
                <div key={asset.id} className="overflow-hidden rounded-md border border-border bg-canvas">
                  <div className="aspect-square">
                    {asset.type === "video" ? (
                      <video src={asset.url} poster={asset.thumbnailMedia?.url} muted preload="metadata" className="h-full w-full object-cover" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element -- seller-uploaded external MinIO URLs, not a static/local asset
                      <img src={asset.url} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => attach(asset.id)}
                    className="w-full px-2 py-1.5 text-xs text-accent transition-smooth-fast hover:bg-accent-subtle"
                  >
                    Attach to this product
                  </button>
                </div>
              ))}
            </div>
          </Disclosure>
        )}

        <Disclosure label="Import from Google Drive">
          {driveConnection === undefined ? (
            <p className="text-sm text-ink-muted">Checking connection…</p>
          ) : !driveConnection || driveConnection.status !== "connected" ? (
            <div className="space-y-2">
              <p className="text-sm text-ink-muted">Connect your Google Drive to import product photos directly.</p>
              <Button type="button" variant="secondary" onClick={connectDrive}>
                Connect Google Drive
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-ink-muted">Connected as {driveConnection.googleAccountEmail}.</p>
              {driveFiles === null ? (
                <Button type="button" variant="secondary" onClick={loadDriveFiles}>
                  Browse Drive files
                </Button>
              ) : driveFiles.length === 0 ? (
                <p className="text-sm text-ink-muted">No importable image files found in Drive.</p>
              ) : (
                <>
                  <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                    {driveFiles.map((file) => (
                      <label key={file.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm transition-smooth-fast hover:bg-canvas">
                        <input type="checkbox" checked={selectedDriveIds.has(file.id)} onChange={() => toggleDriveFile(file.id)} />
                        {file.name}
                      </label>
                    ))}
                  </div>
                  <Button type="button" loading={importing} disabled={selectedDriveIds.size === 0} onClick={importSelected}>
                    Import selected ({selectedDriveIds.size})
                  </Button>
                </>
              )}
            </div>
          )}
        </Disclosure>
      </CardBody>
    </Card>
  );
}
