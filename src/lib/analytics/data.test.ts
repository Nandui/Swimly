import assert from "node:assert/strict";
import { test } from "node:test";
import type { Prisma } from "@/generated/prisma/client";
import { serverModule } from "@/test/server-module";

function fixture() {
  const state = { signedIn: true, allowed: true, canBill: true, siteReads: 0, club: { id: "site-a", name: "Example Pool" }, queries: [] as Prisma.Sql[] };
  const definition = { id: "programme", name: "Swimming", sortOrder: 0, sharedWithId: null, archivedAt: null };
  const tx = {
    level: { findMany: async () => [{ ...definition, id: "level", programmeId: "programme" }] },
    programme: { findMany: async () => [definition] },
    $queryRaw: async (query: Prisma.Sql) => {
      state.queries.push(query);
      if (query.sql.includes('FROM "Enrolment" e')) return [{ studentId: "private-swimmer-id", levelId: "level" }];
      if (query.sql.includes('FROM "AuditLog" a')) return [{ day: "2026-09-13", enrolled: 2, withdrawn: 1 }];
      if (query.sql.includes('FROM "Course" c')) return [{ levelId: "level", capacity: 8, classes: 1 }];
      return [{ sessions: 3, pending: 2, notified: 1, affectedPlaces: 18 }];
    },
  };
  const api = serverModule<typeof import("./data")>("src/lib/analytics/data.ts", {
    "@/lib/authz": {
      AuthorizationError: Error,
      requireSession: async () => { if (!state.signedIn) throw new Error("Sign in required"); return {}; },
      canSee: (_session: unknown, screen: string) => screen === "analytics" ? state.allowed : state.canBill,
    },
    "@/lib/clubs/current": { getCurrentClub: async () => {
      state.siteReads++;
      return { club: state.club, clubs: [{ id: "site-a" }, { id: "site-b" }] };
    } },
    "@/lib/prisma": { prisma: { $transaction: async (run: (transaction: typeof tx) => Promise<unknown>, options: unknown) => {
      assert.deepEqual(options, { isolationLevel: "RepeatableRead" });
      return run(tx);
    } } },
  });
  return { state, ...api };
}

test("analytics refuses ungranted or signed-out access before reading sites or figures", async () => {
  const f = fixture();
  f.state.allowed = false;
  await assert.rejects(f.getAnalytics(), /Analytics access/);
  f.state.allowed = true;
  f.state.signedIn = false;
  await assert.rejects(f.getAnalytics(), /Sign in required/);
  assert.equal(f.state.siteReads, 0);
  assert.equal(f.state.queries.length, 0);
});

test("analytics follows the sidebar site for every query and returns no swimmer identifiers", async () => {
  const f = fixture(), now = new Date("2026-09-13T10:00:00Z");
  const current = await f.getAnalytics(now);
  assert.equal(current.siteName, "Example Pool");
  assert.equal(current.swimmers, 1);
  assert.equal(current.enrolled, 2);
  assert.equal(current.withdrawn, 1);
  assert.equal(current.canOpenCancellations, true);
  assert.equal(JSON.stringify(current).includes("private-swimmer-id"), false);
  assert.equal(current.groups[0].levels[0].capacity, 8);
  assert.equal(current.groups[0].levels[0].percentage, 12.5);
  assert.equal(f.state.queries.length, 4);
  for (const query of f.state.queries) {
    assert.ok(query.values.includes("site-a"));
    assert.equal(query.values.includes("site-b"), false);
  }
  f.state.queries.length = 0;
  f.state.club = { id: "site-b", name: "Second Pool" };
  const switched = await f.getAnalytics(now);
  assert.equal(switched.siteName, "Second Pool");
  assert.equal(switched.canOpenCancellations, true);
  assert.equal(f.state.queries.length, 4);
  for (const query of f.state.queries) {
    assert.equal(query.values.includes("site-a"), false);
    assert.ok(query.values.includes("site-b"));
  }
  f.state.canBill = false;
  assert.equal((await f.getAnalytics(now)).canOpenCancellations, false);
});
