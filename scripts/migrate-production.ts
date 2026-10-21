import "dotenv/config";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { databasePlan } from "../src/lib/database-environment";

// Production applies committed migrations to its database, and so does a
// preview marked DATABASE_ENVIRONMENT=development (the development database).
// A preview without the mark never migrates. A failed
// migration stops deployment. See src/lib/database-environment.ts.
const plan = databasePlan(process.env);
if (plan.errors.length) {
  for (const error of plan.errors) console.error(`error ${error}`);
  process.exit(1);
}
if (plan.migrate) {
  const require = createRequire(import.meta.url);
  const production = process.env.VERCEL_ENV === "production";
  console.log(`Applying committed database migrations (${production ? "production" : "development database"}).`);
  const prismaCli = resolve(dirname(require.resolve("prisma/package.json")), "build/index.js");
  const deploy = () => {
    const run = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], { env: process.env, encoding: "utf8" });
    process.stdout.write(run.stdout ?? "");
    process.stderr.write(run.stderr ?? "");
    return { ok: run.status === 0, unreachable: /\bP10(01|02|17)\b/.test(`${run.stdout}${run.stderr}`) };
  };
  // A preview's development database (a Neon branch) can be asleep, expired or replaced; that is
  // no reason to refuse to build the code (owner, 21 October 2026: "lets not do this again").
  // Production always stops on any failure, and a migration that fails stops a preview too.
  let result = deploy();
  for (let attempt = 1; !production && !result.ok && result.unreachable && attempt <= 3; attempt++) {
    console.warn(`warn  The development database did not answer. Trying again in ${attempt * 10} seconds.`);
    // tsx runs this as CommonJS, where a top-level await does not load: wait without one.
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, attempt * 10_000);
    result = deploy();
  }
  if (!result.ok && !production && result.unreachable) {
    console.warn("warn  The development database cannot be reached, so this preview builds without migrating it. Its pages will fail until the database is back: check the Neon branch the Preview DATABASE_URL points at (docs/database-operations.md).");
  } else if (!result.ok) {
    process.exit(1);
  }
} else {
  console.log("Skipping database migrations: this is local work, or a deployment that shares production's database.");
}
