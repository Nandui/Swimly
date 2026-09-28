import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { Client } from "pg";

/** Copies production's sites, roles and staff accounts into the `dev`
 *  database, so the owner signs in to dev.turnfin.app with their normal email
 *  and password and sees how the real roles convert to levels (owner decision,
 *  28 September 2026).
 *
 *  What it copies: `Club`, `StaffRole` and `User` (name, email, sign-in,
 *  role, job title, site, manager). Never: swimmers, parents, classes,
 *  enrolments, medical notes, the activity log, staff phone numbers, home
 *  addresses, emergency contacts or PINs.
 *
 *  Safety:
 *  - Production is read inside a READ ONLY transaction.
 *  - It writes only to a database that already has the role-levels migration,
 *    which production does not have yet, and never to production's host.
 *  - Dry run by default. Pass --confirm to write, in one transaction.
 *
 *  Put the two unpooled connection strings in `.env.copy` (ignored by Git):
 *    PROD_DATABASE_URL=...   (Vercel → Storage → swimly-db)
 *    DEV_DATABASE_URL=...    (Vercel → Storage → turnfin-dev-db)
 *  then:
 *    npx tsx scripts/copy-staff-to-dev.ts
 *    npx tsx scripts/copy-staff-to-dev.ts --confirm
 *  and delete `.env.copy` afterwards. */

config({ path: ".env.copy", quiet: true });

const TABLES = ["Club", "StaffRole", "User"] as const;
/** Personal details and secrets that stay in production. */
const NEVER: Record<string, readonly string[]> = {
  User: ["phone", "homeAddress", "emergencyName", "emergencyPhone", "emergencyRelationship", "pinHash", "pinFailedAttempts", "pinLockedAt"],
};
const DEV_MARKER = "20261003120000_role_levels";

const q = (name: string) => `"${name.replace(/"/g, '""')}"`;

async function columns(db: Client, table: string) {
  const { rows } = await db.query<{ column_name: string }>(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1",
    [table],
  );
  return new Set(rows.map((r) => r.column_name));
}

async function main() {
  const confirm = process.argv.includes("--confirm");
  const prodUrl = process.env.PROD_DATABASE_URL, devUrl = process.env.DEV_DATABASE_URL;
  if (!prodUrl || !devUrl) throw new Error("Put PROD_DATABASE_URL and DEV_DATABASE_URL in .env.copy first.");
  if (new URL(prodUrl).host === new URL(devUrl).host && new URL(prodUrl).pathname === new URL(devUrl).pathname) {
    throw new Error("PROD_DATABASE_URL and DEV_DATABASE_URL are the same database.");
  }

  const prod = new Client({ connectionString: prodUrl });
  const dev = new Client({ connectionString: devUrl });
  await prod.connect();
  await dev.connect();
  try {
    const marker = await dev.query("SELECT 1 FROM _prisma_migrations WHERE migration_name = $1 AND finished_at IS NOT NULL", [DEV_MARKER]);
    if (marker.rowCount === 0) throw new Error(`DEV_DATABASE_URL does not have ${DEV_MARKER}. It is not the dev database, or its deploy has not finished. Nothing was written.`);
    const prodMarker = await prod.query("SELECT 1 FROM _prisma_migrations WHERE migration_name = $1", [DEV_MARKER]);
    if ((prodMarker.rowCount ?? 0) > 0) throw new Error("PROD_DATABASE_URL already has the dev migrations. Check the two addresses are the right way round. Nothing was written.");

    await prod.query("BEGIN READ ONLY");
    const plan: { table: string; cols: string[]; rows: Record<string, unknown>[] }[] = [];
    for (const table of TABLES) {
      const [source, target] = [await columns(prod, table), await columns(dev, table)];
      const cols = [...source].filter((c) => target.has(c) && !(NEVER[table] ?? []).includes(c));
      const { rows } = await prod.query(`SELECT ${cols.map(q).join(", ")} FROM ${q(table)}`);
      plan.push({ table, cols, rows });
    }
    await prod.query("ROLLBACK");

    for (const p of plan) console.log(`${p.table}: ${p.rows.length} rows (${p.cols.length} columns)`);
    const roles = plan.find((p) => p.table === "StaffRole")!.rows;
    const users = plan.find((p) => p.table === "User")!.rows;
    for (const role of roles) console.log(`  role ${role.name}: ${users.filter((u) => u.staffRoleId === role.id).length} people`);
    if (!confirm) return console.log("\nDry run: nothing written. Pass --confirm to copy into the dev database.");

    await dev.query("BEGIN");
    try {
      for (const { table, cols, rows } of plan) {
        const updates = cols.filter((c) => c !== "id").map((c) => `${q(c)} = EXCLUDED.${q(c)}`).join(", ");
        for (const row of rows) {
          await dev.query(
            `INSERT INTO ${q(table)} (${cols.map(q).join(", ")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")}) ON CONFLICT ("id") DO UPDATE SET ${updates}`,
            cols.map((c) => row[c]),
          );
        }
      }
      // Rows from before the People core belong to LeisureWorld.
      await dev.query(`UPDATE "Club" SET "orgId" = 'org_leisureworld' WHERE "orgId" IS NULL AND EXISTS (SELECT 1 FROM "Organisation" WHERE id = 'org_leisureworld')`);
      await dev.query(`UPDATE "User" SET "orgId" = 'org_leisureworld' WHERE "orgId" IS NULL AND EXISTS (SELECT 1 FROM "Organisation" WHERE id = 'org_leisureworld')`);
      await dev.query(
        `INSERT INTO "AuditLog" ("id", "actorName", "action", "entity", "summary", "module", "createdAt") VALUES ($1, 'Operator script', 'copy-from-production', 'User', $2, 'Admin', now())`,
        [randomUUID(), `Copied ${plan.map((p) => `${p.rows.length} ${p.table}`).join(", ")} from production (staff, roles and sites only; no swimmer data)`],
      );
      await dev.query("COMMIT");
    } catch (error) {
      await dev.query("ROLLBACK");
      throw error;
    }
    console.log("\nCopied into the dev database. Delete .env.copy now.");
  } finally {
    await prod.end();
    await dev.end();
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
