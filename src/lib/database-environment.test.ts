import assert from "node:assert/strict";
import test from "node:test";
import { databasePlan } from "./database-environment";

test("production deployments migrate their own database", () => {
  assert.deepEqual(databasePlan({ VERCEL_ENV: "production" }), { migrate: true, errors: [], warnings: [] });
  assert.equal(databasePlan({ VERCEL_ENV: "production", DATABASE_ENVIRONMENT: "production" }).migrate, true);
});

test("production refuses a database marked for development", () => {
  const plan = databasePlan({ VERCEL_ENV: "production", DATABASE_ENVIRONMENT: "development" });
  assert.equal(plan.migrate, false);
  assert.match(plan.errors[0], /production deployment/);
});

test("the dev deployment migrates once it has its own database", () => {
  assert.deepEqual(databasePlan({ VERCEL_ENV: "preview", DATABASE_ENVIRONMENT: "development", DATABASE_URL: "postgres://u:p@dev.example.test/db" }), { migrate: true, errors: [], warnings: [] });
});

test("a dev deployment still sharing production warns, and can be made to fail", () => {
  const shared = databasePlan({ VERCEL_ENV: "preview" });
  assert.equal(shared.migrate, false);
  assert.match(shared.warnings[0], /shares the production database/);
  const strict = databasePlan({ VERCEL_ENV: "preview", REQUIRE_DEV_DATABASE: "true" });
  assert.equal(strict.errors.length, 1);
});

test("a development database pointing at the production host is refused", () => {
  const plan = databasePlan({ VERCEL_ENV: "preview", DATABASE_ENVIRONMENT: "development", PRODUCTION_DATABASE_HOST: "prod.example.test", DATABASE_URL: "postgres://u:p@PROD.example.test/db" });
  assert.equal(plan.migrate, false);
  assert.match(plan.errors[0], /production database host/);
});

test("local work never migrates, and unknown roles are rejected", () => {
  assert.deepEqual(databasePlan({}), { migrate: false, errors: [], warnings: [] });
  assert.equal(databasePlan({ DATABASE_ENVIRONMENT: "staging" }).errors.length, 1);
});
