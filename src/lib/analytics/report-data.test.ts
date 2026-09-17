import assert from "node:assert/strict";
import { test } from "node:test";
import type { Prisma } from "@/generated/prisma/client";
import { serverModule } from "@/test/server-module";

function fixture() {
  const state = { signedIn: true, allowed: true, courses: false, club: "site-a", siteReads: 0, queries: [] as Prisma.Sql[] };
  const api = serverModule<typeof import("./report-data")>("src/lib/analytics/report-data.ts", {
    "@/lib/authz": { AuthorizationError: Error,
      requireSession: async () => { if (!state.signedIn) throw Error("Sign in required"); return {}; },
      canSee: (_session: unknown, screen: string) => screen === "analytics" ? state.allowed : state.courses },
    "@/lib/clubs/current": { getCurrentClub: async () => { state.siteReads++; return { club: { id: state.club, name: "Example Pool" } }; } },
    "@/lib/prisma": { prisma: { $queryRaw: async (query: Prisma.Sql) => { state.queries.push(query); return []; } } },
  });
  return { ...api, state };
}

test("both reports enforce Analytics access before loading any site or figures", async () => {
  for (const key of ["getReceptionAnalytics", "getInstructorAnalytics"] as const) {
    const f = fixture();
    f.state.allowed = false;
    await assert.rejects(f[key](), /Analytics access/);
    f.state.allowed = true; f.state.signedIn = false;
    await assert.rejects(f[key](), /Sign in/);
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
