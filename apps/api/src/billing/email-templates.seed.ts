import { PrismaClient } from "@prisma/client";

/**
 * Module 65 (SRS §5.6k, FR-6.42) - default copy for the seven admin-editable
 * renewal-reminder/win-back triggers. `create`-only (no `update` override,
 * unlike a SettingsDefinition upsert) - once an admin has edited a
 * template's subject/body, a re-seed must never clobber their edit back to
 * the default.
 */
export async function seedEmailTemplates(prisma: PrismaClient) {
  const templates: { key: string; subject: string; body: string }[] = [
    {
      key: "renewal_reminder_day7",
      subject: "Your uzeyn.com plan renews in 7 days",
      body: "Hi {{businessName}}, your subscription renews in 7 days. Make sure your next plan-fee payment is submitted so your store(s) keep running without interruption.",
    },
    {
      key: "renewal_reminder_day3",
      subject: "Your uzeyn.com plan renews in 3 days",
      body: "Hi {{businessName}}, your subscription renews in 3 days. If you haven't already, submit your plan-fee payment now to avoid any gap in service.",
    },
    {
      key: "renewal_reminder_day1",
      subject: "Your uzeyn.com plan renews tomorrow",
      body: "Hi {{businessName}}, your subscription renews tomorrow. Submit your plan-fee payment today if you haven't yet - your store(s) pause if it's not verified in time.",
    },
    {
      key: "renewal_reminder_expiry_day",
      subject: "Your uzeyn.com plan has expired",
      body: "Hi {{businessName}}, your subscription's billing cycle has ended with no verified renewal payment yet. You still have a short grace window - submit your payment now to avoid your store(s) pausing.",
    },
    {
      key: "winback_day3",
      subject: "We'd love to have you back on uzeyn.com",
      body: "Hi {{businessName}}, your store has been paused for a few days now. A quick plan-fee payment brings it right back online, exactly as you left it.",
    },
    {
      key: "winback_day7",
      subject: "Your store is still waiting for you",
      body: "Hi {{businessName}}, it's been a week since your store paused. Submit a plan-fee payment any time to restore it - nothing has been touched.",
    },
    {
      key: "winback_day14",
      subject: "Last chance: your store's data will be deleted soon",
      body: "Hi {{businessName}}, this is your final win-back reminder. Your store's data is scheduled for permanent deletion very soon under our data-retention policy. Submit a plan-fee payment now to keep everything exactly as it is.",
    },
  ];

  for (const template of templates) {
    await prisma.emailTemplate.upsert({
      where: { key: template.key },
      create: template,
      update: {},
    });
  }
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedEmailTemplates(prisma)
    .then(() => prisma.$disconnect())
    .catch(async (err) => {
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
