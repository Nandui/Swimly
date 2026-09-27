import "dotenv/config";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

/** Designates the organisation's first superadmin.
 *
 *  Only a superadmin can make another from inside the app, so the first one is
 *  an operator action run against the database, like the seed. It refuses once
 *  any active superadmin exists: from then on it is done on the person's Staff
 *  page, where it is guarded and audited like every other change.
 *
 *  Dry run by default. Pass --confirm to write.
 *    npx tsx scripts/grant-superadmin.ts --email owner@example.com --confirm */
async function main() {
  const index = process.argv.indexOf("--email");
  const email = index > 0 ? process.argv[index + 1]?.trim().toLowerCase() : "";
  if (!email) throw new Error("Pass --email <address> of an existing, active account.");
  const confirm = process.argv.includes("--confirm");

  const existing = await prisma.user.count({ where: { isActive: true, isSuperadmin: true } });
  if (existing > 0) throw new Error("A superadmin already exists. Grant further superadmins from their Staff page.");
  const person = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, isActive: true, orgId: true } });
  if (!person?.isActive) throw new Error(`No active account for ${email}.`);
  if (!person.orgId) throw new Error("That account has no organisation. Apply the people-core migration first.");

  console.log(`${confirm ? "Granting" : "Would grant"} superadmin to ${person.name} (${email}).`);
  if (!confirm) return console.log("Dry run. Pass --confirm to write.");
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: person.id }, data: { isSuperadmin: true } });
    await logAudit({ actorId: null, actorName: "Operator script", action: "grant-superadmin", entity: "User", entityId: person.id, summary: `Made ${person.name} the first superadmin` }, tx);
  });
  console.log("Done.");
}

main().then(() => prisma.$disconnect(), async (error) => { console.error(error.message); await prisma.$disconnect(); process.exit(1); });
