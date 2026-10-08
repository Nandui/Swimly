import "dotenv/config";
import { execFileSync } from "node:child_process";
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
  console.log(`Applying committed database migrations (${process.env.VERCEL_ENV === "production" ? "production" : "development database"}).`);
  const prismaCli = resolve(dirname(require.resolve("prisma/package.json")), "build/index.js");
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    stdio: "inherit",
    env: process.env,
  });
} else {
  console.log("Skipping database migrations: this is local work, or a deployment that shares production's database.");
}
