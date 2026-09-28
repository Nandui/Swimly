import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";
import { allModules } from "@/modules/registry";

/** One log, one shape: every audited record type names a real module. */
const { MODULE_OF_ENTITY } = serverModule<typeof import("./audit")>("src/lib/audit.ts", {
  "@/lib/prisma": { prisma: {} },
  "@/lib/clubs/current": { currentClubIdIfAny: async () => null },
});

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "generated" || name === "test" ? [] : sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

test("every record type the app audits belongs to a module", () => {
  const audited = new Set(sources("src").flatMap((file) => [...readFileSync(file, "utf8").matchAll(/entity: "([A-Z][A-Za-z]+)"/g)].map((m) => m[1])));
  assert.ok(audited.size > 20, "the scan found the audited record types");
  const missing = [...audited].filter((entity) => !(entity in MODULE_OF_ENTITY));
  assert.deepEqual(missing, [], `add these to MODULE_OF_ENTITY in src/lib/audit.ts: ${missing.join(", ")}`);
});

test("every module named in the log is a module in the registry", () => {
  const names = new Set(allModules().map((m) => m.logName));
  for (const [entity, name] of Object.entries(MODULE_OF_ENTITY)) assert.ok(names.has(name), `${entity} → ${name}`);
});
