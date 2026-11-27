import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/** The one door to the database. Courses shares Turnfin's main database and queries only its
 *  own tables, plus sites and people's names (docs/courses.md, Data); lint holds that line. */
const globalForDb = globalThis as unknown as { coursesDb?: PrismaClient };

function connect(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
  const max = Number(process.env.DATABASE_POOL_MAX) || undefined;
  const adapter = new PrismaPg({ connectionString, max }, {
    // An unhandled `error` on the pool would take the process down; managed Postgres
    // closes idle connections and emits these while nothing is happening.
    onPoolError: (error) => console.error("[courses] database pool error:", error),
  });
  return new PrismaClient({ adapter });
}

/** One client per process: dev reloads modules on every edit, and each would open a pool. */
export const db: PrismaClient = globalForDb.coursesDb ?? connect();
if (process.env.NODE_ENV !== "production") globalForDb.coursesDb = db;

/** The client inside a transaction: what a write and its log row share. */
export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
