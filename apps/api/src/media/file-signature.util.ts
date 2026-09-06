import { MediaType } from "@prisma/client";

/**
 * Security-audit fix (docs/security-audit-report.md, finding #14):
 * `mediaTypeFromMimetype()` used to trust the client-supplied `mimetype`
 * string alone (`startsWith("image/")`/`"video/"`) - a file whose real
 * bytes were anything, declared e.g. `image/svg+xml`, passed that check
 * and was then served back with that same client-chosen, executable
 * Content-Type. This inspects the file's actual leading bytes against a
 * fixed allow-list of real image/video formats and returns a
 * server-chosen, canonical Content-Type - the client's declared mimetype
 * is never used for storage/serving again. Deliberately hand-rolled
 * rather than a magic-byte-sniffing dependency: the allow-list this
 * platform actually needs is small and fixed, so an explicit, auditable
 * check is preferable to a general-purpose library covering formats
 * nothing here ever accepts.
 */
export interface DetectedMedia {
  type: MediaType;
  contentType: string;
}

function startsWith(buf: Buffer, bytes: number[], offset = 0): boolean {
  if (buf.length < offset + bytes.length) return false;
  for (let i = 0; i < bytes.length; i++) {
    if (buf[offset + i] !== bytes[i]) return false;
  }
  return true;
}

function asciiAt(buf: Buffer, offset: number, length: number): string {
  if (buf.length < offset + length) return "";
  return buf.toString("ascii", offset, offset + length);
}

export function detectImageOrVideo(buffer: Buffer): DetectedMedia | null {
  // JPEG: FF D8 FF
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return { type: "image", contentType: "image/jpeg" };
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { type: "image", contentType: "image/png" };
  }
  // GIF87a / GIF89a
  if (asciiAt(buffer, 0, 4) === "GIF8") return { type: "image", contentType: "image/gif" };
  // WEBP: "RIFF"....."WEBP"
  if (asciiAt(buffer, 0, 4) === "RIFF" && asciiAt(buffer, 8, 4) === "WEBP") {
    return { type: "image", contentType: "image/webp" };
  }
  // ISO base media file format (MP4/MOV/M4V all share this container):
  // a 4-byte box size, then the ASCII box type "ftyp" at offset 4.
  if (asciiAt(buffer, 4, 4) === "ftyp") {
    const brand = asciiAt(buffer, 8, 4);
    return { type: "video", contentType: brand === "qt  " ? "video/quicktime" : "video/mp4" };
  }
  // WEBM/Matroska: EBML header 1A 45 DF A3
  if (startsWith(buffer, [0x1a, 0x45, 0xdf, 0xa3])) return { type: "video", contentType: "video/webm" };

  return null;
}

/** Careers CVs (SRS FR-33.8) - documents, not media; a separate, smaller allow-list. */
export type DetectedDocument = "pdf" | "doc" | "docx";

export function detectDocument(buffer: Buffer): DetectedDocument | null {
  // PDF: "%PDF-"
  if (asciiAt(buffer, 0, 5) === "%PDF-") return "pdf";
  // Legacy .doc - OLE2 Compound File Binary Format signature
  if (startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "doc";
  // .docx is a zip archive (PK\x03\x04) containing word/document.xml as an
  // uncompressed local-header filename - a lightweight, real content check
  // short of full zip parsing, which a mislabeled plain .zip won't contain.
  if (startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]) && buffer.includes("word/document.xml")) return "docx";

  return null;
}
