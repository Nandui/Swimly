import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";
import { expandPermissions } from "@/lib/staff/permissions";
import { cleanLevels, storedAccess } from "@/lib/staff/levels";
import type { HomeViewer } from "@/modules/contributions";

/** The home page is the role's workspace: exactly the role's modules, its home
 *  name, and card lines limited to what the person can already open. */

type Role = { levels: Record<string, string>; extras?: string[]; homeName: string | null; name: string };

function userFor(role: Role) {
  const access = storedAccess(cleanLevels(role.levels, role.extras ?? []));
  return { id: "u1", name: "Synthetic Person", roleId: "r1", roleName: role.name, permissions: access.permissions, screens: access.screens, grants: [], isSuperadmin: false };
}

async function home(role: Role) {
  const user = userFor(role);
  const asked: string[][] = [];
  const { loadHome } = serverModule<typeof import("./home")>("src/lib/home.ts", {
    "server-only": {},
    "next/headers": { cookies: async () => ({ get: () => undefined }) },
    "@/lib/page-guards": { pageSession: async () => ({ user }) },
    "@/lib/prisma": { prisma: { staffRole: { findUnique: async () => ({ name: role.name, homeName: role.homeName }) } } },
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

test("an instructor's home has the swim school only; an unnamed home uses the role's name", async () => {
  const h = await home({ name: "Instructor", homeName: null, levels: { "swim-school": "teach" } });
  assert.equal(h.homeName, "Instructor");
  assert.deepEqual(h.moduleIds, ["swim-school"]);
});

test("the admin module appears only for a role that manages people, roles or sites", async () => {
  assert.ok(!(await home({ name: "Lifeguard", homeName: "Poolside", levels: { docs: "read", rota: "view" } })).moduleIds.includes("admin"));
  assert.ok((await home({ name: "Centre manager", homeName: "Management", levels: { admin: "manage" } })).moduleIds.includes("admin"));
});

function viewer(role: Role): HomeViewer {
  const user = userFor(role);
  return { id: user.id, name: user.name, permissions: user.permissions, screens: user.screens, anywhere: user.permissions, isSuperadmin: false };
}

test("the swim school card lists only what the person can open", async () => {
  const contributions = serverModule<typeof import("@/modules/contributions")>("src/modules/contributions.ts", { "server-only": {} });
  serverModule("src/modules/activities/contributions.ts", { "server-only": {}, "@/lib/prisma": { prisma: {} }, "@/modules/contributions": contributions });
  const labels = async (levels: Record<string, string>, extras: string[] = []) =>
    ((await contributions.homeCardItems(["swim-school"], viewer({ name: "R", homeName: null, levels, extras }))).get("swim-school") ?? []).map((i) => i.label);

  assert.deepEqual(await labels({ "swim-school": "teach" }), ["Your classes today"]);
  const desk = await labels({ "swim-school": "desk" });
  assert.ok(desk.includes("Find a swimmer") && desk.includes("Add a swimmer") && desk.includes("Today's classes"));
  assert.ok(!desk.includes("Your classes today"), "the desk works from the schedule, not the pool deck");
  assert.ok(!desk.includes("Cancelled classes") && !desk.includes("Programmes and levels"));
  assert.ok((await labels({ "swim-school": "desk" }, ["swim-school.cancel-classes"])).includes("Cancelled classes"));
  assert.ok((await labels({ "swim-school": "manage" })).includes("Programmes and levels"));
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

