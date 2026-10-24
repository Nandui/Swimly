import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";
import { SCREENS, visibleScreens } from "@/lib/staff/screens";
import type { PermissionKey } from "@/lib/staff/permissions";
import { allModules, appPermissions, switchableApps } from "@/modules/registry";

/** The pillar "tests pass with any one app switched off" (PRODUCT.md): each app in
 *  src/app/modules.ts is switched off in turn, and Home, the menus, the screens and every other
 *  app's plugs and listeners still answer, while the switched-off app's are gone. Then one app
 *  goes live at one site only. The real registry, session rule, Home loader, plugs and event bus
 *  run; each app's plugs are synthetic stand-ins, so no database is needed. */

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
    contributions.registerHomeCard({ moduleId: app, items: async () => [{ kind: "today", label: app, href: "/", count: 1 }] });
    events.on("tasks.reading.out_of_range", () => { heard.push(app); }, { app });
  }
  contributions.registerMemberDirectory({ app: "swim-school", search: async () => [], byIds: async () => new Map(), create: async () => ({ ok: false, error: "Synthetic" }) });
  const course = (siteId: string) => ({ id: siteId, name: "Synthetic course", description: "", site: { id: siteId, name: siteId, phone: "" }, minAge: null, priceCents: 0, price: "Free", placesLeft: 1, firstDay: "2026-11-02", lastDay: "2026-12-07", sessions: [] });
  contributions.registerAppCourses({ app: "short-courses", list: async () => [course(RIVERSIDE), course(HILLTOP)], one: async (id) => course(id), hold: async () => { throw new Error("not in this test"); }, bookingsFor: async () => [] });

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

const others = (off: string) => APPS.filter((app) => app !== off);
const sorted = (list: Iterable<string>) => [...list].sort();
/** Which app a screen belongs to: the app that gives its permission (Admin's screens belong to none). */
const appOfScreen = (requires: PermissionKey) => APPS.find((app) => appPermissions([app]).has(requires)) ?? null;

for (const off of APPS) {
  test(`with ${off} switched off, Home, the menus and every other app still work`, async () => {
    rows = [{ appId: off, state: "off", siteIds: [] }];
    const { authz, contributions, home, announce } = platform();
    const { session, menus, home: h } = await home(RIVERSIDE);

    // Menus and Home: every other app and Admin, never the switched-off one.
    const expected = allModules().map((m) => m.id).filter((id) => id !== off);
    assert.deepEqual(menus, expected);
    assert.deepEqual(h.moduleIds, expected);
    assert.deepEqual(sorted(h.items.keys()), sorted(others(off)), "Home asks every other app for its items");
    assert.deepEqual(h.failed, []);

    // Screens: the switched-off app's are not found, every other screen opens.
    const screens = visibleScreens(authz.permissionsOf(session as never));
    for (const screen of SCREENS) assert.equal(screens.has(screen.key), appOfScreen(screen.requires) !== off, `screen ${screen.key}`);

    // Plugs: every other app answers; the switched-off one is not available.
    const lines = await contributions.siteSummaryLines([RIVERSIDE, HILLTOP]);
    assert.equal(lines.get(RIVERSIDE), others(off).join(" · "));
    assert.deepEqual((await contributions.personFile("u1", ORG)).map((s) => s.heading), others(off));
    const busy = await contributions.commitmentsFor({ from: "2026-10-26", to: "2026-10-26" });
    assert.deepEqual(sorted(new Set(busy.map((c) => c.label))), sorted(others(off)));
    assert.deepEqual(await contributions.planCommitment(`${off}.busy`, { ref: "x", siteId: RIVERSIDE, date: "2026-10-26", userId: null, by: { id: "u1", name: "Synthetic" } }), { ok: false, error: "That can no longer be planned from here." });
    for (const app of others(off)) assert.deepEqual(await contributions.planCommitment(`${app}.busy`, { ref: "x", siteId: RIVERSIDE, date: "2026-10-26", userId: null, by: { id: "u1", name: "Synthetic" } }), { ok: true });
    assert.deepEqual(sorted((await contributions.deskMeasuresFor({ siteIds: null, from: "2026-10-26", to: "2026-10-26", now: new Date() })).items.map((i) => i.label)), sorted(others(off)));
    assert.deepEqual(sorted((await contributions.memberHistoryFor("m1")).map((e) => e.module)), sorted(others(off)));
    assert.equal((await contributions.members()) === null, off === "swim-school", "the member directory is null only when the swim school is off");
    assert.equal((await contributions.appCourses()) === null, off === "short-courses", "the parents app's courses are null only when Short courses is off");

    // Events: every other app's listener hears it; the switched-off one does not run.
    assert.deepEqual(await announce(RIVERSIDE), others(off));
  });
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

  rows = [{ appId: "short-courses", state: "sites", siteIds: [HILLTOP] }];
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
