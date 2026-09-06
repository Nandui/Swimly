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
  const student = { ...input, id: "swimmer", status: "ACTIVE", clubId: "club" };
  let writes = 0;
  let locked = false;
  const tx = {
    $queryRaw: async () => { locked = true; return []; },
    student: {
      findUnique: async ({ where }: { where: { clubId: string } }) => {
        assert.ok(locked); return where.clubId === student.clubId ? student : null;
      },
      update: async () => { writes++; return student; },
    },
    enrolment: { count: async () => 1 },
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

test("swimmer edits refuse another club's record", async () => {
  const f = fixture(); f.student.clubId = "other";
  assert.equal((await f.actions.updateStudent("swimmer", input)).ok, false);
  assert.equal(f.writes(), 0);
});

test("invalid and future dates of birth return validation errors", async () => {
  const f = fixture();
  for (const dateOfBirth of ["2026-02-31", "2999-01-01"]) {
    assert.equal((await f.actions.createStudent({ ...input, dateOfBirth })).ok, false);
  }
  assert.equal(f.writes(), 0);
});
