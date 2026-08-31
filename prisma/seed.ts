import "dotenv/config";
import bcrypt from "bcryptjs";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { SYSTEM_ROLES, legacyRoleFor } from "@/lib/staff/permissions";

/** Creates the roles the app ships with, and the first admin, so there is a
 *  way in.
 *
 *  Held to the same rules as the app, because a script is not an exception:
 *  idempotent (roles are matched on their name and the admin on their email,
 *  so a second run updates rather than duplicates), self-disabling (declines
 *  to create an account once one can already manage accounts, so leaving it in
 *  a pipeline costs one query), and audited (the row it writes says who
 *  appeared and why).
 *
 *  The roles are upserted on **name only, never on permissions**. A club that
 *  has renamed Instructor or taken a permission off it has said something, and
 *  a re-run of the seed is not the place to argue. Only a role that is missing
 *  entirely gets written. */
async function ensureSystemRoles() {
  let created = 0;

  for (const [index, role] of SYSTEM_ROLES.entries()) {
    const existing = await prisma.staffRole.findUnique({ where: { name: role.name } });
    if (existing) continue;

    await prisma.staffRole.create({
      data: {
        name: role.name,
        description: role.description,
        permissions: role.permissions,
        isSystem: true,
        sortOrder: index,
      },
    });
    created += 1;
  }

  if (created > 0) console.log(`Created ${created} role(s).`);
}

async function main() {
  await ensureSystemRoles();

  // Asked by permission, not by role name: the club may have renamed every
  // role, and what matters is whether anyone can still let someone else in.
  const existing = await prisma.user.findFirst({
    where: { isActive: true, staffRole: { permissions: { has: "staff.manage" } } },
    orderBy: { createdAt: "asc" },
  });
  if (existing) {
    console.log(`Skipped: an account can already manage accounts (${existing.email}).`);
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

  // Whichever role can manage accounts, rather than one called "Admin".
  const adminRole = await prisma.staffRole.findFirst({
    where: { permissions: { has: "staff.manage" } },
    orderBy: { sortOrder: "desc" },
  });
  if (!adminRole) {
    throw new Error(
      "No role grants staff.manage, so the account this creates could not administer anything."
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: name || undefined,
      staffRoleId: adminRole.id,
      role: legacyRoleFor(adminRole.permissions),
      isActive: true,
      passwordHash,
    },
    create: {
      email,
      name: name || email,
      staffRoleId: adminRole.id,
      role: legacyRoleFor(adminRole.permissions),
      passwordHash,
    },
  });

  await logAudit({
    actorId: user.id,
    actorName: user.name,
    action: "create",
    entity: "User",
    entityId: user.id,
    summary: `Seeded the first admin account (${user.email}) on ${adminRole.name}`,
  });

  console.log(`Seeded admin ${user.email} on ${adminRole.name}.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
