import assert from "node:assert/strict";
import { test } from "node:test";
import type { Session } from "next-auth";
import { serverModule } from "@/test/server-module";

/** Owner rules: medical notes reach reception and swim school managers (desk
 *  and office), instructors only on the deck for the class they teach, and no
 *  other role. A Docs-only or Refunds-only role reads no swimmer data at all. */
const session = (permissions: string[], screens: string[], isSuperadmin = false) =>
  ({ user: { id: "x", permissions, screens, isSuperadmin } }) as unknown as Session;
let current: Session;
const classification = serverModule<typeof import("./classification")>("src/modules/activities/classification.ts", {
  "@/lib/authz": { AuthorizationError: class extends Error {}, requireSession: async () => current },
});

const reception = session(["students.manage", "enrolment.manage"], ["students", "courses"]);
const manager = session(["courses.manage", "curriculum.manage"], ["courses", "programmes"]);
const instructor = session(["attendance.mark", "progression.assess"], ["instructor"]);
const viewer = session([], ["calendar", "students"]);
const docsOnly = session(["docs.read"], ["docs"]);
const refundsOnly = session(["refunds.request"], ["refunds"]);

test("medical notes: desk and office roles on the desk; teaching staff on the deck; nobody else", () => {
  assert.equal(classification.medicalAllowed(reception, "desk"), true);
  assert.equal(classification.medicalAllowed(manager, "desk"), true);
  assert.equal(classification.medicalAllowed(instructor, "desk"), false, "an instructor browsing the desk");
  assert.equal(classification.medicalAllowed(instructor, "deck"), true, "the class they are teaching");
  assert.equal(classification.medicalAllowed(viewer, "desk"), false, "a read-only desk role");
  assert.equal(classification.medicalAllowed(docsOnly, "deck"), false);
});

test("withheld notes become a flag, never text", () => {
  const row = { id: "s1", medicalNotes: "Asthma — inhaler in bag" };
  assert.deepEqual(classification.classifyMedical(row, false), { id: "s1", medicalNotes: null, hasMedicalNotes: true });
  assert.deepEqual(classification.classifyMedical(row, true), { ...row, hasMedicalNotes: true });
  assert.deepEqual(classification.classifyMedical({ id: "s2", medicalNotes: "  " }, false), { id: "s2", medicalNotes: null, hasMedicalNotes: false });
});

test("roles outside Aquatics read no swimmer data at all", async () => {
  for (const outsider of [docsOnly, refundsOnly]) {
    current = outsider;
    await assert.rejects(classification.requireActivitiesAccess(), /part of Activities/);
  }
  for (const insider of [reception, instructor, viewer]) {
    current = insider;
    assert.equal(await classification.requireActivitiesAccess(), insider);
  }
});
