"use server";

import { randomUUID } from "node:crypto";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { currentClubId } from "@/lib/clubs/current";
import { dublinInstant } from "@/lib/format";
import { hrDatabase } from "@/modules/hr/shared/database";
import { NOTE_KIND_META, REPORT_KINDS, type NoteKind } from "@/modules/hr/shared/constants";
import { allowedFor, audit, refresh } from "@/modules/hr/shared/writes";

export type ReportInput = { kind: string; body: string; date: string; time: string };

/** A manager on duty puts an issue on someone's HR file (D22). It is always on
 *  the record, never shared with the person, and names the reporter's working
 *  site, whose centre managers see it under Needs you until one reads it.
 *  `hr.reports.write` reads nothing, so it needs no fresh sign-in. */
export async function fileReport(subjectUserId: string, input: ReportInput): Promise<ActionResult> {
  const kind = String(input.kind ?? "") as NoteKind;
  if (!REPORT_KINDS.includes(kind)) return fail("Choose what it is about.", { kind: "Choose what it is about." });
  const text = String(input.body ?? "").trim();
  if (text.length < 3 || text.length > 5000) return fail("Write what happened (up to 5,000 characters).", { body: "Write what happened (up to 5,000 characters)." });
  const time = /^(\d{2}):(\d{2})$/.exec(String(input.time ?? ""));
  const occurredAt = time ? dublinInstant(String(input.date ?? ""), Number(time[1]) * 60 + Number(time[2])) : null;
  if (!occurredAt) return fail("Enter when it happened.", { date: "Enter when it happened." });
  if (occurredAt.getTime() > Date.now() + 5 * 60_000) return fail("It can't have happened in the future.", { date: "It can't have happened in the future." });
  const allowed = await allowedFor("hr.reports.write", subjectUserId);
  if (!allowed.ok) return fail(allowed.error);
  const { actor } = allowed;
  const siteId = await currentClubId();
  const id = randomUUID();
  await hrDatabase().transaction(async (tx) => {
    await tx.query(`INSERT INTO notes (id, org_id, subject_user_id, author_id, author_name, visibility, body, kind, via, occurred_at, site_id)
      VALUES ($1,$2,$3,$4,$5,'record',$6,$7,'report',$8,$9)`,
      [id, actor.orgId ?? "", subjectUserId, actor.id, actor.name, text, kind, occurredAt, siteId]);
    await audit(tx, actor, "create", "HrNote", id, subjectUserId, `Filed a report: ${NOTE_KIND_META[kind].label}`);
  });
  refresh(subjectUserId);
  return ok();
}
