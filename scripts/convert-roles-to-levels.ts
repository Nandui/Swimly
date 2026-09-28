import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { convertRolesToLevels } from "@/lib/staff/convert-roles";

/** Converts every role that still holds screens and permissions into one level
 *  for each module (docs/how-turnfin-works.md). Prints each role's proposed
 *  levels, anything it would gain, and refuses any role that would lose access.
 *  A Viewer-style read-only role gains the desk's editing, because there is no
 *  read-only level: review those before passing --allow-gains.
 *
 *  Dry run by default. Pass --confirm to write.
 *    npx tsx scripts/convert-roles-to-levels.ts
 *    npx tsx scripts/convert-roles-to-levels.ts --confirm
 *    npx tsx scripts/convert-roles-to-levels.ts --confirm --allow-gains */
async function main() {
  const confirm = process.argv.includes("--confirm");
  const allowGains = process.argv.includes("--allow-gains");
  const report = await convertRolesToLevels(prisma, { confirm, allowGains });
  if (report.length === 0) return console.log("Every role already uses levels.");
  for (const role of report) {
    console.log(`\n${role.name} (${role.people} ${role.people === 1 ? "person" : "people"})`);
    console.log(`  Levels: ${role.levels}`);
    if (role.losses.length) console.log(`  Refused, would lose: ${role.losses.join(", ")}`);
    if (role.gains.length) console.log(`  Would gain: ${role.gains.join(", ")}`);
  }
  const converted = report.filter((r) => r.converted).length;
  const waiting = report.filter((r) => !r.converted && r.losses.length === 0).length;
  const refused = report.filter((r) => r.losses.length > 0).length;
  console.log(`\n${converted} of ${report.length} roles ${confirm ? "converted" : "would be converted"}.${waiting ? ` ${waiting} gain access: review them, then pass --allow-gains.` : ""}${refused ? ` ${refused} refused.` : ""}`);
  if (!confirm) console.log("Dry run. Pass --confirm to write.");
}

main().then(() => prisma.$disconnect(), async (error) => { console.error(error.message); await prisma.$disconnect(); process.exit(1); });
