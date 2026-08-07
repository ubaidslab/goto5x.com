import { PrismaClient } from "@prisma/client";

/**
 * Phase B pre-launch audit finding (rate-limit re-audit) - Module 36's admin
 * email surface had two outbound-network actions (a real IMAP+SMTP
 * connection test, a real outbound email send) with no rate limiting beyond
 * the generic 100/min IP throttle, despite being AdminAuthGuard-protected
 * (a compromised admin session could otherwise spam arbitrary recipients or
 * hammer a linked mailbox provider).
 */
export async function seedAdminEmailSettings(prisma: PrismaClient) {
  await prisma.settingsDefinition.upsert({
    where: { key: "admin_email.test_connection_rate_limit_per_hour" },
    create: {
      key: "admin_email.test_connection_rate_limit_per_hour",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 20,
      validation: { min: 1, max: 1000 },
      description: "Maximum POST /admin/email/accounts/:id/test-connection calls per admin per hour.",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "admin_email.reply_rate_limit_per_hour" },
    create: {
      key: "admin_email.reply_rate_limit_per_hour",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 60,
      validation: { min: 1, max: 10000 },
      description: "Maximum POST /admin/email/reply calls per admin per hour.",
    },
    update: {},
  });
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedAdminEmailSettings(prisma)
    .then(() => {
      // eslint-disable-next-line no-console
      console.log("Admin email settings seeded.");
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
