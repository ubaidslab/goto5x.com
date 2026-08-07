import { PrismaClient } from "@prisma/client";

/**
 * Module 22 Phase B (SRS §5.33, FR-33.8) - the application-pipeline
 * stage labels are Settings-Registry-editable display text, never
 * hard-coded English strings, matching FR-33.5's certificate-tier-naming
 * discipline. The underlying five-value state machine
 * (`JobApplicationStatus`) stays fixed - only the outward label per stage
 * is admin-editable data.
 */
export async function seedCareersSettings(prisma: PrismaClient) {
  await prisma.settingsDefinition.upsert({
    where: { key: "careers.application_stage_labels" },
    create: {
      key: "careers.application_stage_labels",
      valueType: "json",
      allowedScopes: ["global"],
      defaultValue: {
        received: "Received",
        reviewing: "Reviewing",
        interviewing: "Interviewing",
        rejected: "Rejected",
        hired: "Hired",
      },
      description: "Display labels for each fixed JobApplicationStatus stage (FR-33.8) - admin-editable, never hard-coded English.",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "careers.apply_rate_limit_per_hour" },
    create: {
      key: "careers.apply_rate_limit_per_hour",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 10,
      validation: { min: 1, max: 1000 },
      description:
        "Maximum POST /careers/:jobPostingId/apply calls per IP per hour (Phase B pre-launch audit finding - public, unauthenticated, accepts a 5MB file upload per call with no prior rate limit).",
    },
    update: {},
  });
}
