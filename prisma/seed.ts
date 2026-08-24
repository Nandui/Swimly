import "dotenv/config";
import bcrypt from "bcryptjs";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

/** Creates the first admin, so there is a way in.
 *
 *  Held to the same rules as the app, because a script is not an exception:
 *  idempotent (matched on the email, so a second run updates rather than
 *  duplicates), self-disabling (declines once any admin exists, so leaving it
 *  in a pipeline costs one query), and audited (the row it writes says who
 *  appeared and why). */
async function main() {
  const existing = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
  });
  if (existing) {
    console.log(`Skipped: an admin already exists (${existing.email}).`);
    return;
  }

  const email = (process.env.SEED_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const name = (process.env.SEED_ADMIN_NAME ?? "").trim();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "";

  if (!email || !password) {
    throw new Error(
      "Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (and optionally SEED_ADMIN_NAME) before seeding."
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: { name: name || undefined, role: "ADMIN", isActive: true, passwordHash },
    create: { email, name: name || email, role: "ADMIN", passwordHash },
  });

  await logAudit({
    actorId: user.id,
    actorName: user.name,
    action: "create",
    entity: "User",
    entityId: user.id,
    summary: `Seeded the first admin account (${user.email})`,
  });

  console.log(`Seeded admin ${user.email}.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
