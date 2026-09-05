"use client";

import { useState } from "react";

interface GalleryMedia {
  id: string;
  url: string;
  type: "image" | "video";
  thumbnailUrl: string | null;
}

/**
 * FR-66.7 (Module 87) - image zoom (click an image to open a larger
 * lightbox view) and video-with-thumbnail (a video plays inline with its
 * seller-chosen poster, no zoom - it's already interactive). No new
 * dependency: a plain click-to-enlarge overlay, not a carousel/gallery
 * library, matching this page's existing hand-rolled/minimal styling.
 */
export function ProductGallery({ media, title }: { media: GalleryMedia[]; title: string }) {
  const [zoomedUrl, setZoomedUrl] = useState<string | null>(null);

  if (media.length === 0) return null;

  return (
    <>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {media.map((asset) =>
          asset.type === "video" ? (
            <video
              key={asset.id}
              src={asset.url}
              poster={asset.thumbnailUrl ?? undefined}
              controls
              style={{ maxWidth: 320, borderRadius: 8 }}
            />
          ) : (
            <button
              key={asset.id}
              type="button"
              onClick={() => setZoomedUrl(asset.url)}
              style={{ padding: 0, border: "none", background: "none", cursor: "zoom-in" }}
              aria-label="Zoom in on this image"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset.url} alt={title} style={{ maxWidth: 320, display: "block", borderRadius: 8 }} />
            </button>
          ),
        )}
      </div>

      {zoomedUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Zoomed product image"
          onClick={() => setZoomedUrl(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            cursor: "zoom-out",
            padding: 24,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoomedUrl}
            alt={title}
            style={{ maxWidth: "min(90vw, 900px)", maxHeight: "90vh", objectFit: "contain", borderRadius: 8 }}
          />
          <button
            type="button"
            onClick={() => setZoomedUrl(null)}
            aria-label="Close zoomed image"
            style={{
              position: "absolute",
              top: 20,
              right: 24,
              background: "none",
              border: "none",
              color: "#fff",
              fontSize: 28,
              lineHeight: 1,
              cursor: "pointer",
            }}
          >
            &times;
          </button>
        </div>
      )}
    </>
  );
}
