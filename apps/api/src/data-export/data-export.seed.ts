import { PrismaClient } from "@prisma/client";

/** Module 24 (SRS §5.36, FR-36.1) - the on-demand export's rate-limit window. */
export async function seedDataExportSettings(prisma: PrismaClient) {
  await prisma.settingsDefinition.upsert({
    where: { key: "data_export.on_demand_min_interval_hours" },
    create: {
      key: "data_export.on_demand_min_interval_hours",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 24,
      validation: { min: 1, max: 720 },
      description: "Minimum hours between a seller's own on-demand data export requests (FR-36.1) - prevents hammering Drive's API or the export job.",
    },
    update: {},
  });
}
