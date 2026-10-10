import assert from "node:assert/strict";
import { test } from "node:test";
import type { Prisma } from "@/generated/prisma/client";
import { serverModule } from "@/test/server-module";

function fixture() {
  const state = { signedIn: true, allowed: true, courses: false, club: "site-a", clubs: ["site-a", "site-b"], siteReads: 0, queries: [] as Prisma.Sql[] };
  const api = serverModule<typeof import("@/modules/activities/features/analytics/server/report-data")>("src/modules/activities/features/analytics/server/report-data.ts", {
    "@/lib/authz": { AuthorizationError: Error,
      requireSession: async () => { if (!state.signedIn) throw Error("Sign in required"); return {}; },
      canSee: (_session: unknown, screen: string) => screen === "analytics" ? state.allowed : state.courses },
    "@/lib/clubs/current": { getCurrentClub: async () => { state.siteReads++; return { club: { id: state.club, name: "Example Pool" }, clubs: state.clubs.map(id => ({ id, name: id })) }; } },
    "@/lib/prisma": { prisma: {
      $queryRaw: async (query: Prisma.Sql) => { state.queries.push(query); return []; },
    } },
  });
  return { ...api, state };
}

test("every report enforces Analytics access before loading any site or figures", async () => {
  const reports = [(f: ReturnType<typeof fixture>) => f.getReceptionAnalytics(), (f: ReturnType<typeof fixture>) => f.getInstructorAnalytics(),
    (f: ReturnType<typeof fixture>) => f.getMultiplePlacesAnalytics("all")];
  for (const load of reports) {
    const f = fixture();
    f.state.allowed = false;
    await assert.rejects(load(f), /Analytics access/);
    f.state.allowed = true; f.state.signedIn = false;
    await assert.rejects(load(f), /Sign in/);
    assert.equal(f.state.siteReads, 0); assert.equal(f.state.queries.length, 0);
  }
});

test("reports follow the current site and class links require their own screen grant", async () => {
  const f = fixture(), now = new Date("2026-09-17T12:00:00Z");
  assert.deepEqual((await f.getReceptionAnalytics(now)).people, []);
  assert.equal((await f.getInstructorAnalytics(now)).canOpenClasses, false);
  for (const sql of f.state.queries) { assert(sql.values.includes("site-a")); assert(!sql.values.includes("site-b")); }
  f.state.queries.length = 0; f.state.club = "site-b"; f.state.courses = true;
  assert.equal((await f.getInstructorAnalytics(now)).canOpenClasses, true);
  await f.getReceptionAnalytics(now);
  for (const sql of f.state.queries) { assert(sql.values.includes("site-b")); assert(!sql.values.includes("site-a")); }
});

test("multiple enrolments reads the current site, or only the person's own sites for All sites", async () => {
  const f = fixture(), now = new Date("2026-09-17T12:00:00Z");
  const site = await f.getMultiplePlacesAnalytics("site", now);
  assert.deepEqual(site.swimmers, []);
  assert.equal(site.allSites, false); assert.equal(site.canOpenSwimmers, false);
  const [one] = f.state.queries;
  assert(one.values.includes("site-a")); assert(!one.values.includes("site-b")); assert(one.values.includes("2026-09-17"));
  assert(!/contact|medical|emergency/i.test(one.sql)); assert(/WAITLISTED/.test(one.sql));

  f.state.queries.length = 0; f.state.clubs = ["site-a", "site-b"];
  const all = await f.getMultiplePlacesAnalytics("all", now);
  assert.equal(all.allSites, true); assert.equal(all.siteName, "All sites");
  assert(f.state.queries[0].values.includes("site-a")); assert(f.state.queries[0].values.includes("site-b"));
  assert(!f.state.queries[0].values.includes("site-c"));

  f.state.queries.length = 0; f.state.clubs = ["site-a"];
  const single = await f.getMultiplePlacesAnalytics("all", now);
  assert.equal(single.allSites, false); assert.equal(single.multipleSites, false);
});
