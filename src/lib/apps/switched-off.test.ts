import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";
import { allModules, switchableApps } from "@/modules/registry";

/** App switches: one app goes live at one site only, and every app is on until a switch is set.
 *  The real registry, session rule, Home loader, plugs and event bus run; each app's plugs are
 *  synthetic stand-ins, so no database is needed. */

const ORG = "org-synthetic", RIVERSIDE = "site-riverside", HILLTOP = "site-hilltop";
const APPS = switchableApps().map((m) => m.id);
let rows: { appId: string; state: string; siteIds: string[] }[] = [];

function platform() {
  const passthrough = { cache: <T,>(fn: T) => fn };
  const auth = { auth: async () => null };
  const switches = serverModule<typeof import("./switches")>("src/lib/apps/switches.ts", {
    react: passthrough,
    "@/auth": auth,
    "@/lib/prisma": { prisma: { appSwitch: { findMany: async () => rows }, organisation: { findFirst: async () => ({ id: ORG }) } } },
  });
  const events = serverModule<typeof import("@/platform/events")>("src/platform/events/index.ts", {});
  const authz = serverModule<typeof import("@/lib/authz")>("src/lib/authz.ts", { "@/auth": auth, "server-only": {}, react: passthrough });
  const contributions = serverModule<typeof import("@/modules/contributions")>("src/modules/contributions.ts", {
    "server-only": {}, "@/lib/apps/switches": switches, "@/platform/events": events, "@/modules/server": {},
  });

  // Every app plugs in one of each kind, and listens to one event.
  const heard: string[] = [];
  for (const app of APPS) {
    contributions.registerSiteSummary({ id: `${app}.site`, app, lines: async (siteIds) => new Map(siteIds.map((siteId) => [siteId, app])) });
    contributions.registerPersonFileSection({ id: `${app}.file`, app, heading: app, load: async () => ({ summary: app, entries: [] }) });
    contributions.registerCommitments({
      id: `${app}.busy`, app,
      list: async () => [RIVERSIDE, HILLTOP].map((siteId) => ({ source: `${app}.busy`, userId: "u1", siteId, date: "2026-10-26", startMinutes: 600, endMinutes: 660, label: app })),
      plan: async () => ({ ok: true }),
    });
    contributions.registerDeskMeasures({ id: `${app}.desk`, app, list: async () => [{ kind: `${app}.job`, label: app, module: app, siteId: RIVERSIDE, userId: null, userName: null, at: "2026-10-26T10:00:00Z", minutes: 5, onTime: null, open: true }] });
    contributions.registerMemberHistory({ id: `${app}.history`, app, list: async () => [{ id: app, title: app, detail: "", on: "2026-10-01", module: app }] });
    contributions.registerMemberNotices({ id: `${app}.notices`, app, list: async () => [{ id: app, label: app, hint: "", href: "/", module: app }] });
    contributions.registerHomeCard({ moduleId: app, items: async () => [{ kind: "today", label: app, href: "/", count: 1 }] });
    events.on("tasks.reading.out_of_range", () => { heard.push(app); }, { app });
  }
  contributions.registerMemberDirectory({ app: "swim-school", search: async () => [], byIds: async () => new Map(), byNumbers: async () => new Map(), create: async () => ({ ok: false, error: "Synthetic" }) });
  const course = (siteId: string) => ({ id: siteId, name: "Synthetic course", description: "", site: { id: siteId, name: siteId, phone: "" }, minAge: null, priceCents: 0, price: "Free", placesLeft: 1, firstDay: "2026-11-02", lastDay: "2026-12-07", sessions: [] });
  contributions.registerAppCourses({ app: "swim-school", list: async () => [course(RIVERSIDE), course(HILLTOP)], one: async (id) => course(id), hold: async () => { throw new Error("not in this test"); }, bookingsFor: async () => [] });

  async function sessionAt(siteId: string) {
    const user = switches.withAppSwitches({ id: "u1", name: "Synthetic Superadmin", roleId: "r1", roleName: "Synthetic", permissions: [] as string[], grants: [], isSuperadmin: true }, await switches.appSwitchesOf(ORG), siteId);
    return { user };
  }

  async function home(siteId: string) {
    const session = await sessionAt(siteId);
    const context = serverModule<typeof import("@/modules/context")>("src/modules/context.ts", { "@/lib/authz": authz });
    const { loadHome } = serverModule<typeof import("@/lib/home")>("src/lib/home.ts", {
      "server-only": {},
      "next/headers": { cookies: async () => ({ get: () => undefined }) },
      "@/lib/page-guards": { pageSession: async () => session },
      "@/lib/prisma": { prisma: { staffRole: { findUnique: async () => ({ name: "Synthetic", homeName: null }) } } },
      "@/lib/clubs/current": { getCurrentClub: async () => ({ club: { id: siteId, name: siteId }, clubs: [] }) },
      "@/modules/context": context,
      "@/modules/server": { homeCardItems: contributions.homeCardItems },
    });
    return { session, menus: context.modulesFor(session as never).map((m) => m.id), home: await loadHome() };
  }

  const announce = (siteId: string) => {
    heard.length = 0;
    return contributions.announce("tasks.reading.out_of_range", { orgId: ORG, siteId, taskId: "t1", task: "Synthetic check", recordedById: "u1", recordedByName: "Synthetic", recordedAt: "2026-10-26T10:00:00Z", readings: [] } as never).then(() => [...heard]);
  };

  return { authz, contributions, home, announce };
}

test("an app on at one site is there, and only there", async () => {
  rows = [{ appId: "rota", state: "sites", siteIds: [RIVERSIDE] }];
  const { contributions, home, announce } = platform();
  assert.ok((await home(RIVERSIDE)).home.moduleIds.includes("rota"));
  const atHilltop = await home(HILLTOP);
  assert.ok(!atHilltop.home.moduleIds.includes("rota"));
  assert.ok(!atHilltop.menus.includes("rota"));

  const lines = await contributions.siteSummaryLines([RIVERSIDE, HILLTOP]);
  assert.ok(lines.get(RIVERSIDE)!.split(" · ").includes("rota"));
  assert.ok(!lines.get(HILLTOP)!.split(" · ").includes("rota"));
  const rota = (await contributions.commitmentsFor({ from: "2026-10-26", to: "2026-10-26" })).filter((c) => c.label === "rota");
  assert.deepEqual(rota.map((c) => c.siteId), [RIVERSIDE]);
  assert.deepEqual((await contributions.personFile("u1", ORG)).map((s) => s.heading), APPS, "a person's file has every app that is on somewhere");
  assert.ok((await announce(RIVERSIDE)).includes("rota"));
  assert.ok(!(await announce(HILLTOP)).includes("rota"));

  rows = [{ appId: "swim-school", state: "sites", siteIds: [HILLTOP] }];
  const courses = (await contributions.appCourses())!;
  assert.deepEqual((await courses.list()).map((c) => c.site.id), [HILLTOP]);
  assert.equal(await courses.one(RIVERSIDE), null);
  assert.ok(await courses.one(HILLTOP));
});

test("every app is on until a switch is set", async () => {
  rows = [];
  const { home, contributions, announce } = platform();
  assert.deepEqual((await home(RIVERSIDE)).home.moduleIds, allModules().map((m) => m.id));
  assert.ok(await contributions.members());
  assert.deepEqual(await announce(HILLTOP), APPS);
});
