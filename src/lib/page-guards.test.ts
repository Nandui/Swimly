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

// Class-page guards (desk versus deck) live with Aquatics: src/modules/aquatics/lib/attendance/page-guard.test.ts
test("instructors cannot open desk or Core screens", async () => {
  for (const screens of [["instructor"], ["today"]]) {
    const access = guards(screens, ["attendance.mark", "attendance.cover", "progression.assess"]);
    for (const screen of ["calendar", "students", "courses", "staff", "duty", "cancellations"] as const) await assert.rejects(access.screenPage(screen), /404/);
  }
});
