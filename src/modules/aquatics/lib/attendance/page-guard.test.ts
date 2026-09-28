import assert from "node:assert/strict";
import { test } from "node:test";
import type { Session } from "next-auth";
import { serverModule } from "@/test/server-module";
import { expandPermissions } from "@/lib/staff/permissions";
import { visibleScreens, type ScreenKey } from "@/lib/staff/screens";

function guard(screens: string[], permissions: string[]) {
  const session = { user: { id: "teacher", permissions, screens } } as Session;
  const authz = {
    can: (_: Session, key: string) => new Set<string>(expandPermissions(permissions)).has(key),
    canSee: (_: Session, screen: ScreenKey) => visibleScreens(screens, expandPermissions(permissions)).has(screen),
  };
  return serverModule<typeof import("./page-guard")>("src/modules/aquatics/lib/attendance/page-guard.ts", {
    "@/lib/authz": authz,
    "@/lib/page-guards": { pageSession: async () => session },
    "next/navigation": { notFound: () => { throw new Error("404"); }, redirect: () => { throw new Error("redirect"); } },
  });
}

test("instructors open their teaching pages but not desk class forms", async () => {
  for (const screens of [["instructor"], ["today"]]) {
    const access = guard(screens, ["attendance.mark", "attendance.cover", "progression.assess"]);
    await access.classPage("instructor");
    await assert.rejects(access.classPage("desk"), /404/);
  }
});

test("desk attendance permission alone never opens the instructor workspace", async () => {
  const desk = guard(["calendar", "courses"], ["attendance.markAny"]);
  await desk.classPage("desk");
  await assert.rejects(desk.classPage("instructor"), /404/);
  await assert.rejects(guard(["instructor"], []).classPage("instructor"), /404/);
  await assert.rejects(guard(["calendar"], []).classPage("desk"), /404/);
});
