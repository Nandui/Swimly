import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";

/** Place changes by an account marked as system (scripted development work) are logged as system;
 *  everything else that account does still carries its name. */
test("only a system account's place changes are marked system, and they read as the system", async () => {
  const written: Record<string, unknown>[] = [];
  const accounts: Record<string, boolean> = { dev: true, desk: false };
  const db = {
    user: { findUnique: async ({ where }: { where: { id: string } }) => (where.id in accounts ? { actsAsSystem: accounts[where.id] } : null) },
    auditLog: { create: async ({ data }: { data: Record<string, unknown> }) => { written.push(data); } },
  };
  const audit = serverModule<typeof import("./audit")>("src/lib/audit.ts", {
    "@/lib/prisma": { prisma: db },
    "@/lib/clubs/current": { currentClubIdIfAny: async () => null },
  });
  await audit.logAudit({ actorId: "dev", actorName: "Dev Example", action: "enrol", entity: "Enrolment", entityId: "p1", clubId: "a", summary: "Enrolled" });
  await audit.logAudit({ actorId: "dev", actorName: "Dev Example", action: "transfer", entity: "Enrolment", entityId: "p2", clubId: "a", summary: "Moved" });
  await audit.logAudit({ actorId: "dev", actorName: "Dev Example", action: "legend-agreement", entity: "Enrolment", entityId: "p2", clubId: "a", summary: "Agreement" });
  await audit.logAudit({ actorId: "dev", actorName: "Dev Example", action: "update", entity: "Student", entityId: "s1", summary: "Details" });
  await audit.logAudit({ actorId: "desk", actorName: "Desk Example", action: "withdraw", entity: "Enrolment", entityId: "p3", clubId: "a", summary: "Unenrolled" });
  assert.deepEqual(written.map((row) => row.system === true), [true, true, false, false, false]);
  assert.equal(audit.actorLabel({ actorName: "Dev Example", system: true }), "System - scripted action done via development");
  assert.equal(audit.actorLabel({ actorName: "Desk Example", system: false }), "Desk Example");
  assert.equal(await audit.isSystemActor("dev"), true);
  assert.equal(await audit.isSystemActor(null), false);
});
