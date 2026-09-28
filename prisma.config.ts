import "dotenv/config";
import { defineConfig } from "prisma/config";

/** Migrations and other CLI work run over a direct connection. A pooled
 *  `DATABASE_URL` (Neon, Supabase, pgBouncer) cannot run DDL, so set
 *  `DIRECT_URL` to the unpooled counterpart in any environment that pools.
 *  A database attached through Vercel's Neon integration provides it as
 *  `DATABASE_URL_UNPOOLED`; everywhere else the two are the same string and
 *  this falls through. */
const cliUrl = process.env["DIRECT_URL"] ?? process.env["DATABASE_URL_UNPOOLED"] ?? process.env["DATABASE_URL"];

export default defineConfig({
  // One schema split by area: base, core, work, activities (see docs/architecture.md).
  schema: "prisma/schema",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: cliUrl,
  },
});
