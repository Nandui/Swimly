import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";
import * as format from "@/lib/format";
import { expandPermissions } from "@/lib/staff/permissions";
import { cleanLevels, storedPermissions } from "@/lib/staff/levels";
import type { HomeViewer } from "@/modules/contributions";

/** The home page is the role's workspace: exactly the role's modules, its home
 *  name, and card lines limited to what the person can already open. */

type Role = { levels: Record<string, string>; extras?: string[]; homeName: string | null; name: string };

function userFor(role: Role) {
  const permissions = storedPermissions(cleanLevels(role.levels, role.extras ?? []));
  return { id: "u1", name: "Synthetic Person", roleId: "r1", roleName: role.name, permissions, grants: [], isSuperadmin: false };
}

async function home(role: Role) {
  const user = userFor(role);
  const asked: string[][] = [];
  const { loadHome } = serverModule<typeof import("./home")>("src/lib/home.ts", {
    "server-only": {},
    "next/headers": { cookies: async () => ({ get: () => undefined }) },
    "@/lib/page-guards": { pageSession: async () => ({ user }) },
    "@/lib/prisma": { prisma: { staffRole: { findUnique: async () => ({ name: role.name, homeName: role.homeName }) } } },
    "@/lib/clubs/current": { getCurrentClub: async () => ({ club: { id: "c1", name: "Synthetic site" }, clubs: [] }) },
    "@/lib/authz": { permissionsOf: (s: { user: { permissions: string[] } }) => expandPermissions(s.user.permissions) },
    "@/modules/server": { homeCardItems: async (ids: string[]) => { asked.push(ids); return new Map(); } },
  });
  return { ...(await loadHome()), asked };
}

test("a receptionist's home is Front of House, with exactly their modules", async () => {
  const h = await home({ name: "Receptionist", homeName: "Front of House", levels: { "swim-school": "desk", refunds: "use", docs: "read", rota: "view" } });
  assert.equal(h.homeName, "Front of House");
  assert.deepEqual(h.moduleIds, ["swim-school", "refunds", "docs", "rota"]);
  assert.deepEqual(h.asked, [h.moduleIds], "cards are asked for the role's modules only");
});

test("a swim teacher's home has the pool deck only; an unnamed home uses the role's name", async () => {
  const h = await home({ name: "Instructor", homeName: null, levels: { "pool-deck": "teach" } });
  assert.equal(h.homeName, "Instructor");
  assert.deepEqual(h.moduleIds, ["pool-deck"]);
});

test("the admin module appears only for a role that manages people, roles or sites", async () => {
  assert.ok(!(await home({ name: "Lifeguard", homeName: "Poolside", levels: { docs: "read", rota: "view" } })).moduleIds.includes("admin"));
  assert.ok((await home({ name: "Centre manager", homeName: "Management", levels: { admin: "manage" } })).moduleIds.includes("admin"));
});

function viewer(role: Role): HomeViewer {
  const user = userFor(role);
  return { id: user.id, name: user.name, permissions: user.permissions, anywhere: user.permissions, isSuperadmin: false };
}

/** Today at a synthetic site: three classes, one of them cancelled; the
 *  person teaches two and covers none. */
const course = (id: string, instructorId: string, startMinutes: number) => ({ id, instructorId, startMinutes, durationMinutes: 30, location: "Main pool", name: null, level: { name: `Level ${id}` } });
function swimSchool() {
  const contributions = serverModule<typeof import("@/modules/contributions")>("src/modules/contributions.ts", { "server-only": {} });
  serverModule("src/modules/activities/contributions.ts", {
    "server-only": {},
    "@/lib/prisma": { prisma: { parentChangeRequest: { count: async () => 2 } } },
    "@/modules/contributions": contributions,
    "@/lib/format": { ...format, today: () => "2026-09-29", minutesNow: () => 0 },
    "@/modules/activities/lib/courses/data/courses": { getCoursesOnDay: async () => [course("a", "u1", 960), course("b", "u1", 1020), course("c", "someone", 1080)] },
    "@/modules/activities/lib/attendance/data/cover": { getCoversForDay: async () => new Map() },
    "@/modules/activities/lib/cancellations/data": { getCancellationsForDay: async () => new Map([["b", { id: "x", courseId: "b", reason: "Pool closed" }]]) },
    "@/modules/activities/lib/today/assessments": { getTodayAssessments: async () => [{ booked: 4 }] },
    "@/modules/activities/lib/enrolment/data/awaiting-enrolment": { getAwaitingEnrolment: async () => ({ total: 0 }) },
  });
  return async (levels: Record<string, string>, extras: string[] = [], id = "swim-school") =>
    (await contributions.homeCardItems([id], viewer({ name: "R", homeName: null, levels, extras }))).get(id) ?? [];
}

test("the swim school card lists only what the person can open", async () => {
  const items = swimSchool();
  const labels = async (levels: Record<string, string>, extras: string[] = [], id = "swim-school") => (await items(levels, extras, id)).map((i) => i.label);

  assert.deepEqual(await labels({ "pool-deck": "teach" }, [], "pool-deck"), ["Your classes today", "Open my classes", "Find a swimmer in your classes"]);
  assert.deepEqual(await labels({ "swim-school": "desk" }, [], "pool-deck"), [], "the desk never gets the pool deck");
  const desk = await labels({ "swim-school": "desk" });
  assert.ok(desk.includes("Find a swimmer") && desk.includes("Add a swimmer") && desk.includes("Classes today"));
  assert.ok(!desk.includes("Cancelled classes") && !desk.includes("Programmes and levels"));
  assert.ok((await labels({ "swim-school": "desk" }, ["swim-school.cancel-classes"])).includes("Cancelled classes"));
  assert.ok((await labels({ "swim-school": "manage" })).includes("Programmes and levels"));
});

test("today's figures leave out cancelled classes, and a teacher sees only their own", async () => {
  const items = swimSchool();
  const desk = await items({ "swim-school": "desk" });
  const classes = desk.find((i) => i.label === "Classes today");
  assert.deepEqual([classes?.kind, classes?.count, classes?.hint], ["today", 2, "1 class cancelled"]);
  assert.equal(desk.find((i) => i.label === "Assessments today")?.hint, "4 swimmers booked");
  const updates = desk.find((i) => i.label === "Parent updates");
  assert.deepEqual([updates?.count, updates?.attention], [2, true]);
  const mine = (await items({ "pool-deck": "teach" }, [], "pool-deck"))[0];
  assert.equal(mine.count, 1, "their cancelled class and someone else's are left out");
  assert.deepEqual(mine.list?.map((l) => l.label), ["Level a"]);
  assert.equal(mine.hint, "Next at 16:00");
});

test("one module's failing card never breaks the home page", async () => {
  const contributions = serverModule<typeof import("@/modules/contributions")>("src/modules/contributions.ts", { "server-only": {} });
  contributions.registerHomeCard({ moduleId: "broken", items: async () => { throw new Error("database down"); } });
  contributions.registerHomeCard({ moduleId: "fine", items: async () => [{ label: "Fine", href: "/fine" }] });
  const quiet = console.error;
  console.error = () => {};
  try {
    const items = await contributions.homeCardItems(["broken", "fine"], viewer({ name: "R", homeName: null, levels: {} }));
    assert.equal(items.has("broken"), false);
    assert.deepEqual(items.get("fine"), [{ label: "Fine", href: "/fine" }]);
  } finally {
    console.error = quiet;
  }
});

