import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/** One client per process. Next.js reloads modules on every edit in dev, so
 *  without the global the dev server opens a new pool every time you save. */
const globalForPrisma = globalThis as unknown as {
  prisma?: InstanceType<typeof PrismaClient>;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and point it at a Postgres database."
    );
  }

  const adapter = new PrismaPg(
    { connectionString },
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

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
