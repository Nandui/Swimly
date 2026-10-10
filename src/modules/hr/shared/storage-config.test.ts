import assert from "node:assert/strict";
import { test } from "node:test";
import { hrStorageConfig } from "@/modules/hr/shared/storage-config";

const hr = "postgresql://u:p@ep-hr-pooler.example.test/neondb";
const hrDirect = "postgresql://u:p@ep-hr.example.test/neondb";
const main = "postgresql://u:p@ep-main.example.test/neondb";

test("HR storage: off when unset, from HR_DATABASE_URL or the Neon integration's HR_DB prefix", () => {
  assert.equal(hrStorageConfig({ DATABASE_URL: main }), null);
  assert.deepEqual(hrStorageConfig({ HR_DATABASE_URL: hr, HR_DIRECT_URL: hrDirect }), { runtime: hr, direct: hrDirect });
  assert.deepEqual(hrStorageConfig({ HR_DB_DATABASE_URL: hr, HR_DB_DATABASE_URL_UNPOOLED: hrDirect }), { runtime: hr, direct: hrDirect }, "the integration's names");
  assert.deepEqual(hrStorageConfig({ HR_DATABASE_URL: hr, HR_DB_DATABASE_URL: main }), { runtime: hr, direct: hr }, "the explicit name wins");
});

test("HR storage: never a shared database", () => {
  assert.throws(() => hrStorageConfig({ HR_DB_DATABASE_URL: main, DATABASE_URL: main }), /its own database/);
  assert.throws(() => hrStorageConfig({ HR_DB_DATABASE_URL: hr, HR_DB_DATABASE_URL_UNPOOLED: main }), /same database/);
});
