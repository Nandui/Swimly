import { readFileSync, readdirSync } from "node:fs";
import { Pool, type QueryConfig } from "pg";
import { PGlite } from "@electric-sql/pglite";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

/** Real generated Prisma queries against an isolated PostgreSQL engine. The
 * Pool is never connected to a socket and no environment credentials are read.
 * PGlite has one connection: transactions are queued, not independent backends. */
export async function isolatedPrisma(beforeParentMigration?: (db: PGlite) => Promise<void>) {
  const db = new PGlite();
  for (const folder of readdirSync("prisma/migrations").filter(name => /^\d/.test(name)).sort()) {
    if (folder === "20260914160000_parent_api") await beforeParentMigration?.(db);
    await db.exec(readFileSync(`prisma/migrations/${folder}/migration.sql`, "utf8"));
  }
  const queries: string[] = [];
  let tail = Promise.resolve();
  async function acquire() {
    const previous = tail;
    let release!: () => void;
    tail = new Promise<void>(resolve => { release = resolve; });
    await previous;
    return release;
  }
  type Config = QueryConfig & { types: { getTypeParser(oid: number, format: string): (value: string) => unknown } };
  async function query(config: Config | string) {
    const text = typeof config === "string" ? config : config.text;
    queries.push(text);
    const parsers = typeof config === "string" ? undefined : Object.fromEntries(
      [16, 17, 20, 21, 23, 25, 26, 114, 700, 701, 1043, 1082, 1083, 1114, 1184, 1266, 1700, 2950, 3802,
        1000, 1007, 1009, 1016, 1115, 1182, 1185, 1231, 199, 3807].map(oid => [oid, config.types.getTypeParser(oid, "text")])
    );
    const result = await db.query(text, typeof config === "string" ? [] : config.values, { rowMode: "array", parsers });
    return { rows: result.rows, fields: result.fields, rowCount: result.affectedRows ?? result.rows.length };
  }
  const pool = new Pool({ connectionString: "postgresql://isolated:unused@invalid/never-connect" });
  pool.query = (async (config: Config) => {
    const release = await acquire();
    try { return await query(config); } finally { release(); }
  }) as unknown as Pool["query"];
  pool.connect = (async () => {
    const release = await acquire();
    return { query, release, on() {}, removeListener() {} };
  }) as unknown as Pool["connect"];
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  return { db, prisma, queries, async close() { await prisma.$disconnect(); await pool.end(); await db.close(); } };
}
