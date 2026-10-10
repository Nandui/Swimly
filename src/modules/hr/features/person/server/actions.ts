"use server";

import { randomUUID } from "node:crypto";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireSession } from "@/lib/authz";
import { hrDatabase } from "@/modules/hr/shared/database";
import { NOTE_VISIBILITIES, type NoteVisibility } from "@/modules/hr/shared/constants";
import { allowedFor, audit, refresh } from "@/modules/hr/shared/writes";

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export async function addNote(subjectUserId: string, body: string, visibility: string): Promise<ActionResult> {
  const text = String(body ?? "").trim();
  if (text.length < 3 || text.length > 5000) return fail("Write the note (up to 5,000 characters).");
  if (!NOTE_VISIBILITIES.includes(visibility as NoteVisibility)) return fail("Choose who can read it.");
  const allowed = await allowedFor("hr.notes.write", subjectUserId);
  if (!allowed.ok) return fail(allowed.error);
  const { actor } = allowed;
  const id = randomUUID();
  await hrDatabase().transaction(async (tx) => {
    await tx.query(`INSERT INTO notes (id, org_id, subject_user_id, author_id, author_name, visibility, body) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, actor.orgId ?? "", subjectUserId, actor.id, actor.name, visibility, text]);
    await audit(tx, actor, "create", "HrNote", id, subjectUserId, `Added a ${visibility} note`);
  });
  refresh(subjectUserId);
  return ok();
}

export async function withdrawNote(id: string, reason: string): Promise<ActionResult> {
  const why = String(reason ?? "").trim().slice(0, 300);
  if (why.length < 3) return fail("Say briefly why it is withdrawn.");
  const session = await requireSession();
  const orgId = session.user.orgId ?? "";
  const [note] = await hrDatabase().query<{ subjectUserId: string; authorId: string }>(
    `SELECT subject_user_id AS "subjectUserId", author_id AS "authorId" FROM notes WHERE id=$1 AND org_id=$2 AND withdrawn_at IS NULL`, [id, orgId]);
  if (!note) return fail("That note no longer exists.");
  const allowed = await allowedFor("hr.notes.write", note.subjectUserId);
  if (!allowed.ok) return fail(allowed.error);
  const { actor } = allowed;
  if (note.authorId !== actor.id && !actor.superadmin) return fail("Only the author can withdraw a note.");
  await hrDatabase().transaction(async (tx) => {
    await tx.query(`UPDATE notes SET withdrawn_at=now(), withdrawn_reason=$2 WHERE id=$1 AND withdrawn_at IS NULL`, [id, why]);
    await audit(tx, actor, "withdraw", "HrNote", id, note.subjectUserId, `Withdrew a note: ${why}`);
  });
  refresh(note.subjectUserId);
  return ok();
}
