import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { Client } from "pg";

/** Replaces the `dev` database's data with a full copy of production's main
 *  database, so dev.turnfin.app shows real volumes (owner decision,
 *  29 September 2026: "everything, as it is").
 *
 *  What it copies: every table the two databases share, every shared column,
 *  as it is, including swimmers, parents, medical notes and the activity log.
 *  Never: live parent sign-in tokens, sign-in challenges and rate limits
 *  (credentials, not data). Columns only dev has keep their defaults. Docs
 *  and HR have their own databases and are not touched.
 *
 *  Safety:
 *  - Production is read in one READ ONLY, REPEATABLE READ transaction, so the
 *    copy is a consistent snapshot.
 *  - It writes only to a database that already has the role-levels migration,
 *    which production does not have yet, and never to production's host.
 *  - Dry run by default. Pass --confirm to replace dev's data, in one
 *    transaction: dev is emptied and filled, or left as it was.
 *
 *  Afterwards run `scripts/convert-roles-to-levels.ts` against dev, because
 *  production's roles have no levels yet.
 *
 *  Put the two unpooled connection strings in `.env.copy` (ignored by Git):
 *    PROD_DATABASE_URL=...   (Vercel → Storage → swimly-db)
 *    DEV_DATABASE_URL=...    (Vercel → Storage → turnfin-dev-db)
 *  then:
 *    npx tsx scripts/copy-prod-to-dev.ts
 *    npx tsx scripts/copy-prod-to-dev.ts --confirm
 *  and delete `.env.copy` afterwards. */

config({ path: ".env.copy", quiet: true });

const DEV_MARKER = "20261003120000_role_levels";
/** Credentials and throttles, not data: they stay in production. */
const SKIP = new Set(["_prisma_migrations", "ParentSession", "ParentSignInChallenge", "ParentRateLimit"]);
const CHUNK = 500;

const q = (name: string) => `"${name.replace(/"/g, '""')}"`;

async function tables(db: Client) {
  const { rows } = await db.query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'",
  );
  return new Set(rows.map((r) => r.table_name));
}

async function columns(db: Client, table: string) {
  const { rows } = await db.query<{ column_name: string; is_nullable: string }>(
    "SELECT column_name, is_nullable FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1",
    [table],
  );
  return new Map(rows.map((r) => [r.column_name, r.is_nullable === "YES"]));
}

/** Dev's foreign keys: which table each column points at. */
async function foreignKeys(db: Client) {
  const { rows } = await db.query<{ table: string; ref: string; cols: string[] }>(`
    SELECT c.conrelid::regclass::text AS table, c.confrelid::regclass::text AS ref,
           array_agg(a.attname ORDER BY a.attname)::text[] AS cols
    FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.contype = 'f' AND c.connamespace = current_schema()::regnamespace
    GROUP BY c.oid, c.conrelid, c.confrelid`);
  const clean = (name: string) => name.replace(/^"|"$/g, "");
  return rows.map((r) => ({ table: clean(r.table), ref: clean(r.ref), cols: r.cols }));
}

async function primaryKey(db: Client, table: string) {
  const { rows } = await db.query<{ attname: string }>(
    `SELECT a.attname FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
     WHERE i.indrelid = $1::regclass AND i.indisprimary`,
    [q(table)],
  );
  return rows.map((r) => r.attname);
}

type Plan = { table: string; cols: string[]; deferred: string[]; key: string[]; rows: unknown[] };

async function main() {
  const confirm = process.argv.includes("--confirm");
  const prodUrl = process.env.PROD_DATABASE_URL, devUrl = process.env.DEV_DATABASE_URL;
  if (!prodUrl || !devUrl) throw new Error("Put PROD_DATABASE_URL and DEV_DATABASE_URL in .env.copy first.");
  if (new URL(prodUrl).host.replace("-pooler", "") === new URL(devUrl).host.replace("-pooler", "")) {
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

    const [prodTables, devTables] = [await tables(prod), await tables(dev)];
    const shared = [...prodTables].filter((t) => devTables.has(t) && !SKIP.has(t));
    const onlyProd = [...prodTables].filter((t) => !devTables.has(t) && !SKIP.has(t));
    if (onlyProd.length) console.log(`Only in production, not copied: ${onlyProd.join(", ")}`);

    // Order tables so each is loaded after the tables it points at. A column in
    // a cycle (including one pointing at its own table, like a manager) is
    // loaded empty and filled in afterwards; it has to be nullable.
    const fks = (await foreignKeys(dev)).filter((f) => shared.includes(f.table));
    const cols = new Map<string, Map<string, boolean>>();
    for (const t of shared) {
      const [p, d] = [await columns(prod, t), await columns(dev, t)];
      cols.set(t, new Map([...p.keys()].filter((c) => d.has(c)).map((c) => [c, d.get(c)!])));
    }
    const deferred = new Map<string, Set<string>>(shared.map((t) => [t, new Set()]));
    const order: string[] = [];
    const remaining = new Set(shared);
    const defer = (f: { table: string; cols: string[] }) => {
      for (const c of f.cols) {
        if (cols.get(f.table)!.get(c) === false) throw new Error(`${f.table}.${c} is in a reference cycle but cannot be empty.`);
        if (cols.get(f.table)!.has(c)) deferred.get(f.table)!.add(c);
      }
    };
    for (const f of fks) if (f.table === f.ref) defer(f);
    while (remaining.size) {
      const waiting = (t: string) => fks.filter((f) => f.table === t && f.ref !== t && remaining.has(f.ref) && shared.includes(f.ref) && !f.cols.every((c) => deferred.get(t)!.has(c)));
      const ready = [...remaining].filter((t) => waiting(t).length === 0);
      if (ready.length) { for (const t of ready) { order.push(t); remaining.delete(t); } continue; }
      // A cycle: defer the first nullable reference that is holding a table up.
      const breakable = [...remaining].flatMap(waiting).find((f) => f.cols.every((c) => cols.get(f.table)!.get(c) !== false));
      if (!breakable) throw new Error(`Cannot order these tables: ${[...remaining].join(", ")}`);
      defer(breakable);
    }

    await prod.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const plan: Plan[] = [];
    for (const table of order) {
      const list = [...cols.get(table)!.keys()];
      // Postgres writes each row as JSON and reads it back the same way, so
      // dates, times, arrays and JSON survive without the driver's time zone.
      const { rows } = await prod.query<{ data: string }>(`SELECT coalesce(json_agg(t), '[]')::text AS data FROM (SELECT ${list.map(q).join(", ")} FROM ${q(table)}) t`);
      plan.push({ table, cols: list, deferred: [...deferred.get(table)!], key: await primaryKey(dev, table), rows: JSON.parse(rows[0].data) });
    }
    await prod.query("ROLLBACK");

    let total = 0;
    for (const p of plan) { total += p.rows.length; if (p.rows.length) console.log(`${p.table}: ${p.rows.length}${p.deferred.length ? ` (then ${p.deferred.join(", ")})` : ""}`); }
    console.log(`\n${total} rows in ${plan.length} tables.`);
    if (!confirm) return console.log("\nDry run: nothing written. Pass --confirm to replace the dev database's data.");

    await dev.query("BEGIN");
    try {
      // Empty what production replaces, and (CASCADE) dev rows that point at
      // it. Tables only dev has so far, such as the organisation, stay.
      await dev.query(`TRUNCATE ${[...shared, ...[...SKIP].filter((t) => devTables.has(t) && t !== "_prisma_migrations")].map(q).join(", ")} CASCADE`);
      // Triggers that record history (the parent app's progress events) would
      // record the copied rows a second time: production's history is copied
      // as it is. Off for this transaction only.
      const { rows: triggered } = await dev.query<{ tbl: string }>(
        `SELECT DISTINCT event_object_table AS tbl FROM information_schema.triggers WHERE trigger_schema = current_schema()`,
      );
      const quiet = triggered.map((r) => r.tbl).filter((t) => shared.includes(t));
      for (const t of quiet) await dev.query(`ALTER TABLE ${q(t)} DISABLE TRIGGER USER`);
      for (const p of plan) {
        const select = p.cols.map((c) => (p.deferred.includes(c) ? "NULL" : q(c))).join(", ");
        for (let i = 0; i < p.rows.length; i += CHUNK) {
          await dev.query(`INSERT INTO ${q(p.table)} (${p.cols.map(q).join(", ")}) SELECT ${select} FROM json_populate_recordset(NULL::${q(p.table)}, $1::json)`, [JSON.stringify(p.rows.slice(i, i + CHUNK))]);
        }
      }
      for (const p of plan.filter((x) => x.deferred.length && x.rows.length)) {
        if (!p.key.length) throw new Error(`${p.table} has no primary key to fill in ${p.deferred.join(", ")}.`);
        const set = p.deferred.map((c) => `${q(c)} = x.${q(c)}`).join(", ");
        const match = p.key.map((k) => `t.${q(k)} = x.${q(k)}`).join(" AND ");
        for (let i = 0; i < p.rows.length; i += CHUNK) {
          await dev.query(`UPDATE ${q(p.table)} t SET ${set} FROM json_populate_recordset(NULL::${q(p.table)}, $1::json) x WHERE ${match}`, [JSON.stringify(p.rows.slice(i, i + CHUNK))]);
        }
      }
      for (const t of quiet) await dev.query(`ALTER TABLE ${q(t)} ENABLE TRIGGER USER`);
      // Production predates the People core: its rows belong to dev's one organisation.
      const orgs = await dev.query<{ id: string }>(`SELECT id FROM "Organisation"`);
      if (orgs.rowCount === 1) {
        for (const p of plan) {
          if (!p.cols.includes("orgId") && (await columns(dev, p.table)).has("orgId")) {
            await dev.query(`UPDATE ${q(p.table)} SET "orgId" = $1 WHERE "orgId" IS NULL`, [orgs.rows[0].id]);
          }
        }
      }
      // Counters continue after the copied rows.
      const { rows: sequences } = await dev.query<{ tbl: string; col: string; seq: string }>(`
        SELECT t.relname AS tbl, a.attname AS col, s.relname AS seq
        FROM pg_class s JOIN pg_depend d ON d.objid = s.oid AND d.deptype = 'a'
        JOIN pg_class t ON t.oid = d.refobjid JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
        WHERE s.relkind = 'S' AND s.relnamespace = current_schema()::regnamespace`);
      for (const s of sequences) {
        await dev.query(`SELECT setval(${`'${q(s.seq)}'`}::regclass, coalesce((SELECT max(${q(s.col)}) FROM ${q(s.tbl)}), 1), (SELECT max(${q(s.col)}) FROM ${q(s.tbl)}) IS NOT NULL)`);
      }
      await dev.query(
        `INSERT INTO "AuditLog" ("id", "actorName", "action", "entity", "summary", "module", "createdAt") VALUES ($1, 'Operator script', 'copy-from-production', 'Organisation', $2, 'Admin', now())`,
        [randomUUID(), `Replaced dev's data with production's (${total} rows in ${plan.length} tables)`],
      );
      await dev.query("COMMIT");
    } catch (error) {
      await dev.query("ROLLBACK");
      throw error;
    }
    console.log("\nCopied into the dev database. Now convert its roles to levels, then delete .env.copy.");
  } finally {
    await prod.end();
    await dev.end();
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
