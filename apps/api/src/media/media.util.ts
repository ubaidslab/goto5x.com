import { BadRequestException } from "@nestjs/common";
import { MediaType } from "@prisma/client";

export function mediaTypeFromMimetype(mimetype: string): MediaType {
  if (mimetype.startsWith("image/")) return "image";
  if (mimetype.startsWith("video/")) return "video";
  throw new BadRequestException(`Unsupported media type "${mimetype}" - only images and videos are accepted.`);
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
}
