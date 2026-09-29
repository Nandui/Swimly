import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "dotenv";

/** Runs an operator script against the **production** database.
 *
 *    npm run prod -- scripts/convert-roles-to-levels.ts
 *    npm run prod -- scripts/convert-roles-to-levels.ts --confirm
 *
 *  The connection lives only in `.env.production.local` (ignored by Git),
 *  pasted there once by the owner from the Neon dashboard: Vercel keeps it as a
 *  sensitive variable, so it cannot be pulled. Nothing else reads that file:
 *  `npm run dev`, the sandbox and the build use `.env` or their own settings,
 *  so production is reached only by asking for it here.
 *
 *  Before running, it names the target (host and database, never the
 *  credentials). The scripts themselves stay dry runs until given --confirm. */
const FILE = resolve(".env.production.local");

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

if (!existsSync(FILE)) fail(`No ${FILE}. Paste production's DATABASE_URL there first (see docs/database-operations.md).`);
const values = parse(readFileSync(FILE));
const url = values.DIRECT_URL || values.DATABASE_URL_UNPOOLED || values.DATABASE_URL;
if (!url) fail(`${FILE} has no DATABASE_URL. Paste production's connection string there.`);

let target: URL;
try { target = new URL(url); } catch { fail(`${FILE}: DATABASE_URL is not a valid connection string.`); }

const [script, ...args] = process.argv.slice(2);
if (!script || !/^scripts\/[\w./-]+\.(ts|mts)$/.test(script) || !existsSync(resolve(script))) {
  fail("Name a script under scripts/, e.g. npm run prod -- scripts/convert-roles-to-levels.ts");
}

console.log(`Production database: ${target.hostname}${target.pathname}`);
const env = {
  ...process.env,
  ...values,
  DATABASE_URL: values.DATABASE_URL || url,
  DIRECT_URL: url,
  DATABASE_ENVIRONMENT: "production",
  // Operator scripts load "dotenv/config"; point it at this file, never .env.
  DOTENV_CONFIG_PATH: FILE,
};
const run = spawnSync(process.execPath, [resolve("node_modules/tsx/dist/cli.mjs"), script, ...args], { stdio: "inherit", env });
process.exit(run.status ?? 1);
