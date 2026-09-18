import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";

let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let actions: typeof import("./competencies");
let sharedNameTaken: typeof import("../shared-name").sharedNameTaken;
const state = { allowed: true, revalidated: [] as string[] };

before(async () => {
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  await db.user.create({ data: { id: "editor", email: "editor@example.invalid", name: "Alex Example" } });
  await db.programme.create({ data: { id: "programme", clubId: "club_bishopstown", name: "Example swimming" } });
  await db.programme.create({ data: { id: "programme-copy", clubId: "club_churchfield", name: "Example swimming", sharedWithId: "programme" } });
  await db.level.create({ data: { id: "level", programmeId: "programme", name: "Example level" } });
  await db.level.create({ data: { id: "level-copy", programmeId: "programme-copy", name: "Example level", sharedWithId: "level" } });
  await db.competency.create({ data: { id: "skill", levelId: "level", name: "Float", description: "Original description" } });
  await db.competency.create({ data: { id: "skill-copy", levelId: "level-copy", name: "Float", sharedWithId: "skill" } });
  // A unique skill from a site copy still belongs to the shared level's name space.
  await db.competency.create({ data: { id: "other-skill", levelId: "level-copy", name: "Glide" } });
  await db.assessmentType.create({ data: { id: "assessment-type", programmeId: "programme-copy", name: "Placement" } });
  await db.student.create({ data: { id: "swimmer", clubId: "club_churchfield", firstName: "Avery", lastName: "Example" } });
  await db.competencyResult.create({ data: {
    id: "historical-mark", studentId: "swimmer", competencyId: "skill-copy", status: "ACHIEVED",
    assessedById: "editor", assessedByName: "Alex Example", assessedOn: new Date("2026-09-01"),
  } });
  const boundaries = {
    "@/lib/prisma": { prisma: db },
    "@/lib/authz": { requirePermission: async (permission: string) => {
      assert.equal(permission, "curriculum.manage");
      if (!state.allowed) throw Error("Permission denied");
      return { user: { id: "editor", name: "Alex Example" } };
    } },
    "@/lib/clubs/current": { currentClubIdIfAny: async () => "club_churchfield" },
    "next/cache": { revalidatePath: (path: string) => state.revalidated.push(path) },
    react: { cache: (fn: unknown) => fn },
  };
  // Keep the real shared-name check, audit writer and Prisma pg adapter.
  actions = serverModule("src/lib/curriculum/actions/competencies.ts", boundaries);
  ({ sharedNameTaken } = serverModule<typeof import("../shared-name")>("src/lib/curriculum/shared-name.ts", boundaries));
});

beforeEach(async () => {
  state.allowed = true;
  state.revalidated = [];
  await fixture.prisma.auditLog.deleteMany();
  await fixture.prisma.competency.update({ where: { id: "skill" }, data: { name: "Float", description: "Original description" } });
});
after(async () => { await fixture?.close(); });

test("saving a description with the same name succeeds and records the staff audit", async () => {
  assert.deepEqual(await actions.updateCompetency("skill", { name: "Float", description: "Float for ten seconds" }), { ok: true });
  const saved = await fixture.prisma.competency.findUniqueOrThrow({ where: { id: "skill" } });
  assert.equal(saved.description, "Float for ten seconds");
  const audits = await fixture.prisma.auditLog.findMany();
  assert.equal(audits.length, 1);
  assert.equal(audits[0].actorId, "editor");
  assert.equal(audits[0].actorName, "Alex Example");
  assert.equal(audits[0].entity, "Competency");
  assert.equal(audits[0].entityId, "skill");
  assert.equal(audits[0].action, "update");
  assert.equal(audits[0].programmeId, "programme");
  assert.equal(audits[0].clubId, null);
  assert.deepEqual(state.revalidated, ["/programmes/[id]"]);
});

test("renaming through a site's original ID preserves links and historical marks", async () => {
  const before = await fixture.prisma.competencyResult.findUniqueOrThrow({ where: { id: "historical-mark" } });
  assert.equal((await actions.updateCompetency("skill-copy", { name: "Float on your back", description: "" })).ok, true);
  const saved = await fixture.prisma.competency.findUniqueOrThrow({ where: { id: "skill" } });
  assert.equal(saved.name, "Float on your back");
  assert.equal(saved.levelId, "level");
  assert.equal(saved.description, null);
  assert.equal((await fixture.prisma.competency.findUniqueOrThrow({ where: { id: "skill-copy" } })).sharedWithId, "skill");
  assert.deepEqual(await fixture.prisma.competencyResult.findUniqueOrThrow({ where: { id: "historical-mark" } }), before);
  assert.equal((await fixture.prisma.auditLog.findFirstOrThrow()).entityId, "skill");
});

test("duplicate names in either site are rejected without edits or audits", async () => {
  const before = await fixture.prisma.competency.findUniqueOrThrow({ where: { id: "skill" } });
  const result = await actions.updateCompetency("skill-copy", { name: "  GLIDE  ", description: "Changed" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /already a competency/);
  assert.deepEqual(await fixture.prisma.competency.findUniqueOrThrow({ where: { id: "skill" } }), before);
  assert.equal(await fixture.prisma.auditLog.count(), 0);
  assert.deepEqual(state.revalidated, []);
});

test("creating a competency from a site copy writes to the shared level and audits it", async () => {
  assert.equal((await actions.createCompetency("level-copy", { name: "Kick", description: "Kick with a float" })).ok, true);
  const created = await fixture.prisma.competency.findFirstOrThrow({ where: { name: "Kick" } });
  assert.equal(created.levelId, "level");
  const audit = await fixture.prisma.auditLog.findFirstOrThrow();
  assert.equal(audit.entityId, created.id);
  assert.equal(audit.action, "create");
  assert.equal(audit.actorId, "editor");
  assert.equal((await actions.createCompetency("level", { name: "KICK", description: "" })).ok, false);
  assert.equal(await fixture.prisma.auditLog.count(), 1);
});

test("the shared lock supports each catalogue's duplicate-name check", async () => {
  await fixture.prisma.$transaction(async tx => {
    assert.equal(await sharedNameTaken(tx, "programme", " EXAMPLE SWIMMING "), true);
    assert.equal(await sharedNameTaken(tx, "level", "example level", "programme-copy"), true);
    assert.equal(await sharedNameTaken(tx, "competency", "glide", "level"), true);
    assert.equal(await sharedNameTaken(tx, "type", "placement", "programme"), true);
    assert.equal(await sharedNameTaken(tx, "competency", "Float", "level-copy", "skill"), false);
  });
});

test("saving requires curriculum.manage before any database query", async () => {
  state.allowed = false;
  const queryCount = fixture.queries.length;
  await assert.rejects(actions.updateCompetency("skill", { name: "Changed", description: "" }), /Permission denied/);
  assert.equal(fixture.queries.length, queryCount);
});
