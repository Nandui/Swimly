import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";
import { today } from "@/lib/format";
import type { TemplateInput } from "./actions";

/** Tasks end to end on an isolated database: templates need Manage and publish only when
 *  complete; a day's tasks are made once; only the sites and roles a task is for can do it;
 *  completion checks everything, out-of-range readings need a follow-up; nobody approves their
 *  own; two people saving at once cannot overwrite each other. Invented people and sites. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let actions: typeof import("./actions");
let data: typeof import("./data");
const ORG = "org_leisureworld";
type GrantRow = { roleName: string; permissions: string[]; screens: string[]; scopeKind: string; scopeId: string };
const state = { id: "gina", permissions: [] as string[], grants: [] as GrantRow[] };
let bishopstown = "", churchfield = "";
const day = today();

function session() {
  return { user: { id: state.id, name: state.id, orgId: ORG, isSuperadmin: false, roleName: "Role", permissions: state.permissions, primaryPermissions: state.permissions,
    screens: ["tasks"], primaryScreens: ["tasks"], grants: state.grants, authMethod: "password", authAt: Date.now() } };
}
class NotFound extends Error {}
const as = (id: string, permissions: string[], grants: GrantRow[] = []) => Object.assign(state, { id, permissions, grants });
const at = (siteId: string, permissions: string[]): GrantRow => ({ roleName: "Site", permissions, screens: ["tasks"], scopeKind: "site", scopeId: siteId });

const template = (patch: Partial<TemplateInput> = {}): TemplateInput => ({
  title: "Pool water quality", description: "", siteIds: [bishopstown], roleIds: [], tags: ["Pool"], priority: true, checklist: ["Sample taken"],
  fields: [{ id: "ph", label: "pH", type: "number", required: true, min: 7.2, max: 7.6, needsAction: true }], minimumRecords: 1,
  schedules: [{ id: "allday", repeat: "daily", every: 1, weekdays: [], from: day, start: "00:00", due: "23:59" }],
  requiresComment: false, requiresApproval: true, ...patch,
});

before(async () => {
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  const clubs = await db.club.findMany({ where: { orgId: ORG }, orderBy: { name: "asc" } });
  bishopstown = clubs.find((c) => c.name.includes("Bishopstown"))!.id;
  churchfield = clubs.find((c) => c.name.includes("Churchfield"))!.id;
  await db.staffRole.create({ data: { id: "r-lifeguard", name: "Lifeguard", permissions: [], screens: [] } });
  await db.staffRole.create({ data: { id: "r-desk", name: "Receptionist", permissions: [], screens: [] } });
  for (const [id, role] of [["gina", "r-desk"], ["lena", "r-lifeguard"], ["rob", "r-desk"], ["dan", "r-desk"], ["carl", "r-lifeguard"]]) {
    await db.user.create({ data: { id, name: id, email: `${id}@example.invalid`, staffRoleId: role, orgId: ORG } });
  }
  const d = {
    "@/lib/prisma": { prisma: db },
    "@/lib/authz": {
      AuthorizationError: class AuthorizationError extends Error {},
      requireSession: async () => session(),
      can: (s: { user: { permissions: string[] } }, p: PermissionKey) => expandPermissions(s.user.permissions).has(p),
      canSee: () => true,
    },
    "@/lib/clubs/current": { currentClubId: async () => bishopstown, currentClubIdIfAny: async () => bishopstown },
    "next/cache": { revalidatePath() {} },
    "next/navigation": { notFound: () => { throw new NotFound("not found"); } },
    "server-only": {},
    react: { cache: <T,>(fn: T) => fn },
  };
  actions = serverModule("src/lib/tasks/actions.ts", d);
  data = serverModule("src/lib/tasks/data.ts", d);
});
after(async () => { await fixture?.close(); });

test("templates need Manage, publish only when complete, and make today's tasks once", async () => {
  as("lena", [], [at(bishopstown, ["tasks.review"])]);
  assert.equal((await actions.saveTaskTemplate(null, null, template(), true)).ok, false, "Review does not write templates");
  as("gina", ["tasks.manage"]);
  assert.equal((await actions.saveTaskTemplate(null, null, template({ checklist: [], fields: [] }), true)).ok, false, "nothing to do");
  const draft = await actions.saveTaskTemplate(null, null, template({ checklist: [], fields: [] }), false);
  assert.ok(draft.ok && draft.id, "a draft can be unfinished");
  assert.equal(await fixture.prisma.task.count(), 0, "a draft makes no tasks");
  const v = (await fixture.prisma.taskTemplate.findUniqueOrThrow({ where: { id: draft.id! } })).version;
  assert.equal((await actions.saveTaskTemplate(draft.id!, v, template(), true)).ok, true, "published");
  assert.equal((await actions.saveTaskTemplate(draft.id!, v, template({ title: "Stale" }), true)).ok, false, "saved from an old version");
  assert.equal(await fixture.prisma.task.count({ where: { siteId: bishopstown } }), 1, "today's task at its one site");
  assert.equal(await fixture.prisma.task.count({ where: { siteId: churchfield } }), 0);
  assert.equal(await data.ensureTasks(ORG, [bishopstown, churchfield], [day]), 0, "making them again is harmless");
  assert.equal(await data.ensureTasks(ORG, [bishopstown], ["2020-01-01"]), 0, "nothing before it was published");
  const audit = await fixture.prisma.auditLog.findFirstOrThrow({ where: { entity: "TaskTemplate", action: "update" } });
  assert.equal(audit.module, "Tasks");
});

test("doing a task: their sites and roles only, everything answered, an action for a reading out of range", async () => {
  const task = await fixture.prisma.task.findFirstOrThrow({ where: { siteId: bishopstown } });
  // Aimed at lifeguards from now on (the task made earlier was for everyone).
  await fixture.prisma.task.update({ where: { id: task.id }, data: { definition: { ...(task.definition as object), roleIds: ["r-lifeguard"] } } });
  as("rob", [], [at(churchfield, ["tasks.complete"])]);
  await assert.rejects(data.taskDetail(task.id), NotFound, "another site's task is a 404");
  assert.equal((await actions.saveTaskProgress(task.id, task.version, { checks: [true], records: [{ ph: "7.4" }] })).ok, false);
  as("rob", [], [at(bishopstown, ["tasks.complete"])]);
  const forRob = await data.taskDetail(task.id);
  assert.equal(forRob.can.work, false, "aimed at lifeguards, and Rob is on the desk");
  assert.equal((await actions.completeTask(task.id, task.version, { checks: [true], records: [{ ph: "7.4" }] })).ok, false);

  as("lena", [], [at(bishopstown, ["tasks.complete"])]);
  const day1 = await data.taskDay(bishopstown, undefined);
  assert.equal(day1.tasks!.length, 1);
  assert.equal(day1.tasks![0].mine, true);
  const missing = await actions.completeTask(task.id, task.version, { checks: [false], records: [{}] });
  assert.ok(!missing.ok && /Tick every checklist item/.test(missing.error) && /pH needs an answer/.test(missing.error));
  assert.equal((await actions.saveTaskProgress(task.id, task.version, { checks: [true], records: [{ ph: "8.2", junk: "x" }] })).ok, true);
  const saved = await fixture.prisma.task.findUniqueOrThrow({ where: { id: task.id } });
  assert.deepEqual(saved.records, [{ ph: "8.2" }], "only the answers it asks for");
  assert.equal((await actions.saveTaskProgress(task.id, task.version, { checks: [true], records: [{ ph: "7.4" }] })).ok, false, "two people at once: the second is told to reload");
  const high = await actions.completeTask(task.id, saved.version, { checks: [true], records: [{ ph: "8.2" }] });
  assert.ok(!high.ok && /follow-up action/.test(high.error));
  assert.equal((await actions.raiseTaskAction({ siteId: churchfield, taskId: task.id, title: "Retest after dosing", dueOn: day })).ok, true, "raised at the task's own site");
  const action = await fixture.prisma.taskAction.findFirstOrThrow({ where: { taskId: task.id } });
  assert.equal(action.siteId, bishopstown);
  assert.equal((await actions.completeTask(task.id, saved.version, { checks: [true], records: [{ ph: "8.2" }] })).ok, true);
  const done = await fixture.prisma.task.findUniqueOrThrow({ where: { id: task.id } });
  assert.equal(done.status, "done");
  assert.deepEqual(done.exceptions, ["pH 8.2 (7.2 to 7.6)."]);
  assert.equal((await data.taskDay(bishopstown, undefined)).tasks![0].state, "approval");
  assert.equal((await actions.setTaskActionResolved(action.id, true, "Dosing adjusted, retested 7.4")).ok, false, "resolving needs Review");
});

test("reviewing: nobody approves their own; reopen and not applicable need Review at the site", async () => {
  const task = await fixture.prisma.task.findFirstOrThrow({ where: { siteId: bishopstown } });
  as("lena", [], [at(bishopstown, ["tasks.review"])]);
  assert.equal((await actions.approveTask(task.id, task.version)).ok, false, "Lena completed it");
  as("dan", [], [at(churchfield, ["tasks.review"])]);
  assert.equal((await actions.approveTask(task.id, task.version)).ok, false, "Dan reviews another site");
  as("dan", [], [at(bishopstown, ["tasks.review"])]);
  assert.equal((await data.taskDetail(task.id)).can.approve, true);
  assert.equal((await actions.approveTask(task.id, task.version)).ok, true);
  assert.equal((await data.taskDay(bishopstown, undefined)).figures!.score, 100);
  const approved = await fixture.prisma.task.findUniqueOrThrow({ where: { id: task.id } });
  assert.equal((await actions.reopenTask(task.id, approved.version)).ok, true);
  const reopened = await fixture.prisma.task.findUniqueOrThrow({ where: { id: task.id } });
  assert.equal(reopened.approvedAt, null);
  assert.deepEqual(reopened.records, [{ ph: "8.2" }], "the answers stay");
  as("carl", [], [at(bishopstown, ["tasks.complete"])]);
  assert.equal((await actions.notApplicableTask(task.id, reopened.version, "Pool closed")).ok, false, "not applicable needs Review");
  assert.equal((await actions.cantCompleteTask(task.id, reopened.version, "")).ok, false, "a reason");
  assert.equal((await actions.cantCompleteTask(task.id, reopened.version, "Test kit is empty")).ok, true);
  assert.equal((await data.taskDay(bishopstown, undefined)).figures!.score, 0);
  as("dan", [], [at(bishopstown, ["tasks.review"])]);
  const action = await fixture.prisma.taskAction.findFirstOrThrow({ where: { taskId: task.id } });
  assert.equal((await actions.setTaskActionResolved(action.id, true, "")).ok, false, "what was done");
  assert.equal((await actions.setTaskActionResolved(action.id, true, "Dosing adjusted, retested 7.4")).ok, true);
  assert.equal((await data.taskActions(bishopstown)).open.length, 0);
  const report = await data.taskReport({ from: day, to: day });
  assert.deepEqual(report.bySite.map((s) => [s.id, s.total, s.missed]), [[bishopstown, 1, 1]], "only the sites Dan reviews");
  as("lena", [], [at(bishopstown, ["tasks.complete"])]);
  await assert.rejects(data.taskReport({}), NotFound, "reports need Review");
});

test("added by hand, with a photo checked by its first bytes", async () => {
  as("gina", ["tasks.manage"]);
  const spill = await actions.saveTaskTemplate(null, null, template({ title: "Spill clean-up", siteIds: [], schedules: [], requiresApproval: false, checklist: [],
    fields: [{ id: "photo", label: "Photo after", type: "file", required: true }] }), true);
  assert.ok(spill.ok && spill.id);
  as("rob", [], [at(churchfield, ["tasks.complete"])]);
  const dayView = await data.taskDay(churchfield, undefined);
  assert.deepEqual(dayView.addable!.map((t) => t.title), ["Spill clean-up"]);
  assert.equal((await actions.addTask(spill.id!, bishopstown, day)).ok, false, "only at their sites");
  const added = await actions.addTask(spill.id!, churchfield, day);
  assert.ok(added.ok && added.id);
  const fake = new FormData();
  fake.set("file", new File(["not an image"], "photo.png", { type: "image/png" }));
  assert.equal((await actions.uploadTaskFile(added.id!, fake)).ok, false, "a renamed text file is refused");
  const png = new FormData();
  png.set("file", new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])], "after.png", { type: "image/png" }));
  const up = await actions.uploadTaskFile(added.id!, png);
  assert.ok(up.ok && up.fileId);
  const t = await fixture.prisma.task.findUniqueOrThrow({ where: { id: added.id! } });
  assert.equal((await actions.completeTask(t.id, t.version, { checks: [], records: [{ photo: "someone-elses-file" }] })).ok, false, "a file from another task is dropped");
  assert.equal((await actions.completeTask(t.id, t.version, { checks: [], records: [{ photo: up.fileId! }] })).ok, true);
});
