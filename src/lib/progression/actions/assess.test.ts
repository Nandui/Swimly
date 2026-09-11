import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";
import { sharedCurriculumRows } from "@/test/curriculum";

type Mark = { studentId: string; competencyId: string; status: "ACHIEVED" | "WORKING_ON"; assessedOn: Date; updatedAt: Date; assessedByName: string };
type Completion = { id: string; studentId: string; levelId: string; programmeId: string; completedOn: Date };
function fixture() {
  const marks: Mark[] = [{ studentId: "swimmer", competencyId: "entry-b-skill", status: "ACHIEVED", assessedOn: new Date("2026-09-01"), updatedAt: new Date("2026-09-01"), assessedByName: "Original Assessor" }];
  const completions: Completion[] = [];
  const audits: { action: string; clubId?: string; entityId: string }[] = [];
  let locked = false, allowed = true, auditFails = false, overrides = false;
  const curriculum = sharedCurriculumRows();
  const student = { id: "swimmer", firstName: "Synthetic", lastName: "Swimmer", clubId: "other" };
  const tx = {
    $queryRaw: async () => { locked = true; return []; },
    programme: { findMany: async () => { assert.ok(locked); return curriculum; } },
    student: {
      findMany: async () => [student],
      findUnique: async () => student,
    },
    competencyResult: {
      findMany: async () => structuredClone(marks),
      deleteMany: async ({ where }: { where: { competencyId: { in: string[] } } }) => { for (let i = marks.length - 1; i >= 0; i--) if (where.competencyId.in.includes(marks[i].competencyId)) marks.splice(i, 1); },
      upsert: async ({ create }: { create: Omit<Mark, "updatedAt"> }) => { const i = marks.findIndex(m => m.competencyId === create.competencyId); const row = { ...create, updatedAt: new Date() }; if (i < 0) marks.push(row); else marks[i] = row; },
    },
    levelCompletion: {
      findFirst: async ({ where }: { where: { levelId: { in: string[] } } }) => completions.find(c => where.levelId.in.includes(c.levelId)) ?? null,
      findUnique: async ({ where }: { where: { id: string } }) => { const c = completions.find(c => c.id === where.id); return c ? { ...c, student, level: { name: "Entry" } } : null; },
      findMany: async () => structuredClone(completions),
      create: async ({ data }: { data: Omit<Completion, "id"> }) => { const c = { ...data, id: `completion-${completions.length}` }; completions.push(c); return c; },
      delete: async ({ where }: { where: { id: string } }) => { const i = completions.findIndex(c => c.id === where.id); if (i >= 0) completions.splice(i, 1); },
    },
    auditLog: { create: async ({ data }: { data: typeof audits[number] }) => { if (auditFails) throw Error("audit failed"); audits.push(data); } },
  };
  let queue = Promise.resolve();
  const prisma = { ...tx, $transaction: async (run: (client: typeof tx) => Promise<unknown>) => {
    const previous = queue; let release!: () => void; queue = new Promise<void>(resolve => { release = resolve; }); await previous;
    const before = structuredClone({ marks, completions, audits });
    try { return await run(tx); }
    catch (e) { marks.splice(0, marks.length, ...before.marks); completions.splice(0, completions.length, ...before.completions); audits.splice(0, audits.length, ...before.audits); throw e; }
    finally { locked = false; release(); }
  } };
  const actions = serverModule<typeof import("./assess")>("src/lib/progression/actions/assess.ts", {
    "@/lib/prisma": { prisma },
    "@/lib/authz": { requirePermission: async () => { if (!allowed) throw Error("denied"); return { user: { id: "staff", name: "New Assessor" } }; }, can: () => overrides },
    "@/lib/clubs/current": { currentClubId: async () => "club", currentClubIdIfAny: async () => "club" },
    "next/cache": { revalidatePath: () => {} },
  });
  return { actions, marks, completions, audits, curriculum, deny: () => { allowed = false; }, failAudit: () => { auditFails = true; }, override: () => { overrides = true; } };
}
const completion = { studentId: "swimmer", levelId: "entry", note: "", overrideReason: "" };

test("an unchanged judgement from another site retains its original assessor; clearing it removes all copies", async () => {
  const f = fixture();
  const input = { studentId: "swimmer", levelId: "entry", results: [{ competencyId: "entry-skill", status: "ACHIEVED" as const }] };
  assert.equal((await f.actions.saveAssessment(input)).ok, true);
  assert.equal(f.marks.length, 1); assert.equal(f.marks[0].assessedByName, "Original Assessor"); assert.equal(f.audits.length, 0);
  assert.equal((await f.actions.saveAssessment({ ...input, results: [{ competencyId: "entry-b-skill", status: null }] })).ok, true);
  assert.equal(f.marks.length, 0); assert.equal(f.audits.length, 1);
});

test("shared marks permit completion and concurrent confirmations create just one record", async () => {
  const f = fixture();
  const results = await Promise.all([f.actions.confirmLevelCompletion(completion), f.actions.confirmLevelCompletion({ ...completion, levelId: "entry-b" })]);
  assert.equal(results.filter(r => r.ok).length, 1);
  assert.equal(f.completions.length, 1); assert.equal(f.completions[0].levelId, "entry"); assert.equal(f.audits.length, 1);
});

test("an existing completion at either site blocks another and revocation removes both audited copies", async () => {
  const f = fixture();
  f.completions.push({ id: "old", studentId: "swimmer", levelId: "entry-b", programmeId: "programme-b", completedOn: new Date("2026-09-01") });
  assert.equal((await f.actions.confirmLevelCompletion(completion)).ok, false);
  f.completions.push({ ...f.completions[0], id: "other", levelId: "entry", programmeId: "programme" });
  assert.equal((await f.actions.revokeLevelCompletion("old", { reason: "Recorded in error" })).ok, true);
  assert.equal(f.completions.length, 0); assert.equal(f.audits.length, 2);
});

test("corrections at either site affect eligibility and overrides still require permission and a reason", async () => {
  const f = fixture(); f.marks.push({ ...f.marks[0], competencyId: "entry-skill", status: "WORKING_ON", updatedAt: new Date("2026-09-02") });
  assert.equal((await f.actions.confirmLevelCompletion(completion)).ok, false);
  f.override(); assert.equal((await f.actions.confirmLevelCompletion(completion)).ok, false);
  assert.equal((await f.actions.confirmLevelCompletion({ ...completion, overrideReason: "Equivalent prior demonstration" })).ok, true);
});

test("shared progress rolls back when auditing fails and authorizes before accessing data", async () => {
  const f = fixture(); f.failAudit();
  await assert.rejects(f.actions.confirmLevelCompletion(completion), /audit failed/);
  assert.equal(f.completions.length, 0);
  f.deny(); await assert.rejects(f.actions.saveAssessment({ studentId: "swimmer", levelId: "entry", results: [] }), /denied/);
  await assert.rejects(f.actions.confirmLevelCompletion(completion), /denied/);
});
