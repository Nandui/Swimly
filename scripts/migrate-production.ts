import "dotenv/config";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

// Preview and local builds may share production's database. Only the actual
// production deployment applies committed migrations, before compiling code
// that depends on them. A failed migration stops deployment.
if (process.env.VERCEL_ENV === "production") {
  const require = createRequire(import.meta.url);
  console.log("Applying committed production database migrations.");
  const prismaCli = resolve(dirname(require.resolve("prisma/package.json")), "build/index.js");
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    stdio: "inherit",
    env: process.env,
  });
} else {
  console.log("Skipping database migrations outside Vercel production.");
}
