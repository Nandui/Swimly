import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import test from "node:test";
import { ACTIVITIES_PATHS, crossesZone, zoneFor } from "./zones";

test("Activities paths, their children and assets belong to the Activities app", () => {
  for (const href of ["/schedule", "/students/abc?tab=progress", "/instructor/classes/x", "/api/parent/v1/me", "/activities-static/_next/x.js"]) {
    assert.equal(zoneFor(href), "activities", href);
  }
  for (const href of ["/", "/staff", "/account", "/modules?view=all", "/docs", "/refunds/1", "/students-archive", "/help/instructor"]) {
    assert.equal(zoneFor(href), "work", href);
  }
});

test("a link crosses apps only when it leaves the current one", () => {
  assert.equal(crossesZone("/students", "work"), true);
  assert.equal(crossesZone("/students", "activities"), false);
  assert.equal(crossesZone("/account", "activities"), true);
  assert.equal(crossesZone("https://example.test/students", "work"), false);
});

test("every Activities app route is in the routing table", () => {
  const app = "apps/activities/src/app";
  const routes = [
    ...readdirSync(`${app}/(activities)`, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => `/${d.name}`),
    ...readdirSync(`${app}/(instructor)`, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => `/${d.name}`),
    ...readdirSync(`${app}/api`, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => `/api/${d.name}`),
  ];
  for (const route of routes) assert.ok((ACTIVITIES_PATHS as readonly string[]).includes(route), `${route} is missing from ACTIVITIES_PATHS`);
  assert.equal(routes.length, ACTIVITIES_PATHS.length);
});

test("the Activities app config uses the same asset prefix as the routing table", async () => {
  const { readFileSync } = await import("node:fs");
  const { ACTIVITIES_ASSET_PREFIX } = await import("./zones");
  assert.ok(readFileSync("apps/activities/next.config.ts", "utf8").includes(`const ACTIVITIES_ASSET_PREFIX = "${ACTIVITIES_ASSET_PREFIX}";`));
});
