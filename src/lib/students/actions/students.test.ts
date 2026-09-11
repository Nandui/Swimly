import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";

type Actions = typeof import("./students");
const input: import("./students").StudentInput = {
  memberNumber: "", firstName: "Test", lastName: "Swimmer", dateOfBirth: "", status: "INACTIVE",
  contactName: "", contactEmail: "", contactPhone: "", emergencyName: "", emergencyPhone: "",
  emergencyRelationship: "", medicalNotes: "", notes: "", photoConsent: false,
};

function fixture() {
  const student = { ...input, id: "swimmer", status: "ACTIVE", clubId: "club", dateOfBirth: null, photoConsentOn: null };
  let writes = 0;
  let locked = false;
  const tx = {
    $queryRaw: async () => { locked = true; return []; },
    student: {
      findUnique: async ({ where }: { where: { id: string; clubId?: string } }) => {
        assert.ok(locked); return where.id === student.id && (!where.clubId || where.clubId === student.clubId) ? student : null;
      },
      update: async () => { writes++; return student; },
    },
    enrolment: { count: async () => 1 },
    auditLog: { create: async () => ({}) },
  };
  const prisma = { ...tx, $transaction: async (run: (db: typeof tx) => Promise<unknown>) => run(tx) };
  const actions = serverModule<Actions>("src/lib/students/actions/students.ts", {
    "@/lib/prisma": { prisma },
    "@/lib/authz": { requirePermission: async () => ({ user: { id: "staff", name: "Test Staff" } }) },
    "@/lib/clubs/current": { currentClubId: async () => "club" },
    "next/cache": { revalidatePath: () => {} },
  });
  return { actions, student, writes: () => writes };
}

test("editing a full swimmer form cannot bypass the active-enrolment guard", async () => {
  const f = fixture();
  assert.equal((await f.actions.updateStudent("swimmer", input)).ok, false);
  assert.equal(f.writes(), 0);
});

test("swimmer edits allow another site's record and retain the active-place guard", async () => {
  const f = fixture(); f.student.clubId = "other";
  assert.equal((await f.actions.updateStudent("swimmer", { ...input, status: "ACTIVE", contactName: "Updated contact" })).ok, true);
  assert.equal(f.writes(), 1);
});

test("invalid and future dates of birth return validation errors", async () => {
  const f = fixture();
  for (const dateOfBirth of ["2026-02-31", "2999-01-01"]) {
    assert.equal((await f.actions.createStudent({ ...input, dateOfBirth })).ok, false);
  }
  assert.equal(f.writes(), 0);
});

test("adding a swimmer returns their ID only after the create with registration-site provenance and audit commit", async () => {
  const events: string[] = [];
  const paths: string[] = [];
  let rejectAudit = false;
  const tx = { student: { create: async ({ data }: { data: { clubId: string } }) => {
    assert.equal(data.clubId, "club"); events.push("create");
    return { id: "new-swimmer", firstName: "Test", lastName: "Swimmer" };
  } } };
  const actions = serverModule<Actions>("src/lib/students/actions/students.ts", {
    "@/lib/prisma": { prisma: { $transaction: async (run: (db: typeof tx) => Promise<unknown>) => {
      const result = await run(tx); events.push("commit"); return result;
    } } },
    "@/lib/authz": { requirePermission: async (permission: string) => {
      assert.equal(permission, "students.manage"); events.push("authorize");
      return { user: { id: "staff", name: "Test Staff" } };
    } },
    "@/lib/clubs/current": { currentClubId: async () => "club" },
    "@/lib/audit": { logAudit: async (entry: { entityId: string }, db: unknown) => {
      assert.equal(entry.entityId, "new-swimmer"); assert.equal(db, tx); events.push("audit");
      if (rejectAudit) throw new Error("Audit unavailable");
    } },
    "next/cache": { revalidatePath: (path: string) => paths.push(path) },
  });
  assert.deepEqual(await actions.createStudent(input), { ok: true, studentId: "new-swimmer" });
  assert.deepEqual(events, ["authorize", "create", "audit", "commit"]);
  assert.deepEqual(paths, ["/reception", "/students"]);
  events.length = 0; paths.length = 0; rejectAudit = true;
  await assert.rejects(actions.createStudent(input), /Audit unavailable/);
  assert.equal(events.includes("commit"), false);
  assert.deepEqual(paths, []);
});
