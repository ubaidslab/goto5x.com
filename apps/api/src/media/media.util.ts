import { BadRequestException } from "@nestjs/common";
import { detectImageOrVideo, DetectedMedia } from "./file-signature.util";

/**
 * Security-audit fix (docs/security-audit-report.md, finding #14): this
 * used to trust the client-supplied mimetype string alone. Now inspects
 * the file's actual bytes and returns a server-chosen, canonical
 * Content-Type - the caller's own declared mimetype is no longer read at
 * all for classification or storage.
 */
export function detectMediaTypeOrThrow(buffer: Buffer): DetectedMedia {
  const detected = detectImageOrVideo(buffer);
  if (!detected) {
    throw new BadRequestException("Unsupported file - only real image or video content is accepted.");
  }
  return detected;
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
}
