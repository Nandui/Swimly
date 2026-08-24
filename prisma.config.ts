import "dotenv/config";
import { defineConfig } from "prisma/config";

/** Migrations and other CLI work run over a direct connection. A pooled
 *  `DATABASE_URL` (Neon, Supabase, pgBouncer) cannot run DDL, so set
 *  `DIRECT_URL` to the unpooled counterpart in any environment that pools;
 *  everywhere else the two are the same string and this falls through. */
const cliUrl = process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"];

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: cliUrl,
  },
});
