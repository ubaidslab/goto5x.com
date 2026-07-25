import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

/**
 * One-time local-dev convenience: creates a single super_admin account so
 * there's a first login for `/admin/login` on a fresh database. There is no
 * "default admin" seeded automatically - admin login always requires MFA
 * (SRS §6.5/FR-8.12, AdminAuthService.login() only ever returns a
 * preAuthToken, never a full session), so this script creates the account
 * with mfaEnabled: false and leaves the actual TOTP enrollment to the normal
 * first-login flow in the browser at /admin/login (scan the QR code shown
 * there into an authenticator app) - exactly the same flow a real admin goes
 * through, not a bypass of it.
 *
 * Usage: npx ts-node scripts/create-local-admin.ts [email] [password]
 * Defaults: admin@local.test / ChangeMe123!
 */
(async () => {
  const email = process.argv[2] ?? "admin@local.test";
  const password = process.argv[3] ?? "ChangeMe123!";

  const prisma = new PrismaClient();
  const existing = await prisma.user.findUnique({ where: { email }, include: { adminUser: true } });
  if (existing?.adminUser) {
    // eslint-disable-next-line no-console
    console.log(`Admin account already exists for ${email} - not creating a duplicate.`);
    await prisma.$disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash, roleFlags: ["admin"], emailVerifiedAt: new Date() },
  });
  await prisma.adminUser.create({ data: { userId: user.id, role: "super_admin", mfaEnabled: false } });
  await prisma.$disconnect();

  // eslint-disable-next-line no-console
  console.log(`Created admin ${email} / ${password}. Log in at /admin/login - you'll be walked through TOTP enrollment on first login.`);
})().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
