import assert from "node:assert/strict";
import { test } from "node:test";
import { hrStorageConfig, legacyHrSource } from "@/modules/hr/shared/storage-config";

const hr = "postgresql://u:p@ep-hr-pooler.example.test/neondb";
const hrDirect = "postgresql://u:p@ep-hr.example.test/neondb";
const main = "postgresql://u:p@ep-main-pooler.example.test/neondb";
const mainDirect = "postgresql://u:p@ep-main.example.test/neondb";

test("HR storage is the main database (D23): off only when there is no database at all", () => {
  assert.equal(hrStorageConfig({}), null);
  assert.deepEqual(hrStorageConfig({ DATABASE_URL: main, DIRECT_URL: mainDirect }), { runtime: main, direct: mainDirect });
  assert.deepEqual(hrStorageConfig({ DATABASE_URL: main }), { runtime: main, direct: main });
  assert.deepEqual(hrStorageConfig({ DATABASE_URL: main, HR_DATABASE_URL: hr }), { runtime: main, direct: main }, "the old HR settings no longer pick HR's database");
});

test("the old separate HR database is the one-time copy's source, preferring its unpooled URL, never the main database", () => {
  assert.equal(legacyHrSource({ DATABASE_URL: main }), null);
  assert.equal(legacyHrSource({ DATABASE_URL: main, HR_DB_DATABASE_URL: hr, HR_DB_DATABASE_URL_UNPOOLED: hrDirect }), hrDirect);
  assert.equal(legacyHrSource({ DATABASE_URL: main, HR_DATABASE_URL: hr }), hr);
  assert.equal(legacyHrSource({ DATABASE_URL: main, DIRECT_URL: mainDirect, HR_DATABASE_URL: main }), null, "the same database is not a source");
});
