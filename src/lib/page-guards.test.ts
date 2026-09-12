import assert from "node:assert/strict";
import { test } from "node:test";
import type { Session } from "next-auth";
import { serverModule } from "@/test/server-module";
import { expandPermissions } from "./staff/permissions";
import { visibleScreens, type ScreenKey } from "./staff/screens";

function guards(screens: string[], permissions: string[]) {
  const session = { user: { id: "teacher", permissions, screens } } as Session;
  const authz = {
    can: (_: Session, key: string) => new Set<string>(expandPermissions(permissions)).has(key),
    canSee: (_: Session, screen: ScreenKey) => visibleScreens(screens, expandPermissions(permissions)).has(screen),
  };
  return serverModule<typeof import("./page-guards")>("src/lib/page-guards.ts", {
    "@/auth": { auth: async () => session }, "@/lib/authz": authz,
    "next/navigation": { notFound: () => { throw new Error("404"); }, redirect: () => { throw new Error("redirect"); } },
  });
}

test("instructors can open their teaching pages but not desk screens or desk class forms", async () => {
  for (const screens of [["instructor"], ["today"]]) {
    const access = guards(screens, ["attendance.mark", "attendance.cover", "progression.assess"]);
    await access.classPage("instructor");
    await assert.rejects(access.classPage("desk"), /404/);
    for (const screen of ["calendar", "students", "courses", "staff", "overview"] as const) await assert.rejects(access.screenPage(screen), /404/);
  }
});

test("desk attendance permission alone never opens the instructor workspace", async () => {
  const desk = guards(["calendar", "courses"], ["attendance.markAny"]);
  await desk.classPage("desk");
  await assert.rejects(desk.classPage("instructor"), /404/);
  await assert.rejects(guards(["instructor"], []).classPage("instructor"), /404/);
  await assert.rejects(guards(["calendar"], []).classPage("desk"), /404/);
});
