import assert from "node:assert/strict";
import { test } from "node:test";
import type { Session } from "next-auth";
import { serverModule } from "@/test/server-module";
import { expandPermissions } from "@/lib/staff/permissions";
import { visibleScreens, type ScreenKey } from "@/lib/staff/screens";

function guard(permissions: string[]) {
  const session = { user: { id: "teacher", permissions } } as unknown as Session;
  const authz = {
    can: (_: Session, key: string) => new Set<string>(expandPermissions(permissions)).has(key),
    canSee: (_: Session, screen: ScreenKey) => visibleScreens(expandPermissions(permissions)).has(screen),
  };
  return serverModule<typeof import("./page-guard")>("src/modules/activities/lib/attendance/page-guard.ts", {
    "@/lib/authz": authz,
    "@/lib/page-guards": { pageSession: async () => session },
    "next/navigation": { notFound: () => { throw new Error("404"); }, redirect: () => { throw new Error("redirect"); } },
  });
}

test("instructors open their teaching pages but not desk class forms", async () => {
  const access = guard(["attendance.mark", "attendance.cover", "progression.assess"]);
  await access.classPage("instructor");
  await assert.rejects(access.classPage("desk"), /404/);
});

test("the desk never opens the instructor workspace; a pool deck lead opens both class views", async () => {
  const desk = guard(["swimschool.desk", "students.manage", "enrolment.manage"]);
  await assert.rejects(desk.classPage("instructor"), /404/);
  await assert.rejects(desk.classPage("desk"), /404/, "taking attendance is the pool deck's job");
  const lead = guard(["swimschool.desk", "attendance.markAny"]);
  await lead.classPage("desk");
  await lead.classPage("instructor");
  await assert.rejects(guard([]).classPage("instructor"), /404/);
});
