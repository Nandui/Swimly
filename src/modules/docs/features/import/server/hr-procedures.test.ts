import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { validateBody } from "@/modules/docs/shared/content";
import { findMember, rows, type Database } from "@/modules/docs/shared/database";
import { DocumentService } from "@/modules/docs/shared/domain";
import { canManage } from "@/modules/docs/shared/types";
import { createDocsTestDatabase } from "@/test/docs-database";
import { textOf } from "@/modules/docs/features/import/server/markdown";
import { HR_PROCEDURES } from "@/modules/docs/features/import/content/hr-procedures";
import { hrProcedurePages, hrProcedureStatus } from "@/modules/docs/features/import/server/ready-made";

/** The HR procedures (Docs Administration › HR procedures) come into Docs as drafts. */
const pages = hrProcedurePages("2026-10-21");

test("every HR procedure reads as a valid SOP with its own reference", () => {
  assert.equal(pages.length, 10);
  assert.deepEqual(pages.map((p) => p.reference), Array.from({ length: 10 }, (_, i) => `HR-SOP-0${i}`));
  for (const page of pages) {
    assert.equal(page.type, "SOP", page.reference);
    assert.equal(page.reviewDate, "2027-10-01", page.reference);
    assert.ok(page.summary.length > 40 && !page.summary.startsWith("Applies to"), `${page.reference} has a Purpose`);
    assert.doesNotThrow(() => validateBody(page.body), page.reference);
  }
});

test("only the overview carries the not-legal-advice note", () => {
  assert.deepEqual(pages.filter((p) => /not legal advice/i.test(textOf(p.body))).map((p) => p.reference), ["HR-SOP-00"]);
  assert.ok(HR_PROCEDURES.every((text) => /^Tags: SOP, Draft$/m.test(text)));
});

let db: Database;
before(async () => { db = await createDocsTestDatabase(); });
after(async () => { await db.close(); });

test("a Docs administrator adds them as their drafts once; a second click adds nothing", async () => {
  const service = new DocumentService(db);
  await assert.rejects(service.addReadyMade("jamie", "HR procedures", pages), /administration/i);
  const admin = (await Promise.all(["alex", "jamie", "sam", "riley"].map((id) => findMember(db, id)))).find((m) => m && canManage(m))!;
  assert.ok(admin, "the test database has a Docs administrator");
  assert.deepEqual(await service.addReadyMade(admin.id, "HR procedures", pages), { added: 10, alreadyThere: 0 });
  const drafts = await rows<{ reference: string; owner: string; creator: string; published: string | null }>(db,
    "SELECT d.content->>'reference' AS reference, d.content->>'ownerId' AS owner, doc.created_by AS creator, doc.current_version_id AS published FROM drafts d JOIN documents doc ON doc.id=d.document_id WHERE d.content->>'reference' LIKE 'HR-SOP-%'");
  assert.equal(drafts.length, 10);
  assert.deepEqual(drafts.filter((d) => d.owner !== admin.id || d.creator !== admin.id || d.published), []);
  assert.ok((await hrProcedureStatus(db)).every((i) => i.added));
  assert.deepEqual(await service.addReadyMade(admin.id, "HR procedures", pages), { added: 0, alreadyThere: 10 });
  const audit = await rows<{ action: string; detail: string }>(db, "SELECT action, detail FROM audit_events WHERE action='ready_made_added'");
  assert.deepEqual(audit, [{ action: "ready_made_added", detail: "HR procedures: 10 added as drafts" }]);
});
