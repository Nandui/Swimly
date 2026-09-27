import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { postgresConnectionString } from "@/lib/postgres-connection";

/** One client per process. Next.js reloads modules on every edit in dev, so
 *  without the global the dev server opens a new pool every time you save. */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and point it at a Postgres database."
    );
  }

  const adapter = new PrismaPg(
    { connectionString: postgresConnectionString(connectionString) },
    {
      // Prisma 7 hands the pool to `pg`, and an unhandled `error` event on a
      // `pg.Pool` is an unhandled EventEmitter error — it takes the whole Node
      // process down. Managed Postgres reaps idle connections and emits these
      // while the dev server sits doing nothing, so this one line is the
      // difference between a log entry and a dead dev server.
      onPoolError: (error) => {
        console.error("[prisma] pool error:", error);
      },
    }
  );

  return new PrismaClient({ adapter });
}

// One declared type: a union of the global's and the constructed client's types makes
// every query compare two versions of each model's generated types, which the
// compiler cannot finish once the schema is large enough.
export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
