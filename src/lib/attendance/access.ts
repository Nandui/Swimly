import type { Session } from "next-auth";
import { can } from "@/lib/authz";

/** Teaching requires a confirmed claim for this class and date. Scheduled
 * assignment alone is not confirmation. Desk transcription remains a separate
 * attendance.markAny permission. */

type Args = {
  session: Session;
  instructorId: string | null;
  /** Who confirmed the class on this date; undefined means no claim. */
  coverById?: string | null;
};

export function canMarkRegister({ session, instructorId, coverById }: Args): boolean {
  if (can(session, "attendance.markAny")) return true;
  return canTeachClass({ session, instructorId, coverById });
}

/** On the pool deck, say who is teaching even when the account also has
 * desk permission to transcribe anybody's attendance. */
export function canTeachClass({ session, coverById }: Args): boolean {
  if (!can(session, "attendance.mark")) return false;
  return coverById != null && coverById === session.user.id;
}

/** Whether this person should be asked if they are taking the class: it is
 *  somebody else's, or nobody's, and they have not already said so. True
 *  even for someone who may mark any register — the question is about who
 *  conducted the class, not about permission — and they are offered the
 *  answer "just recording it for the instructor". */
export function needsTakeOver({ session, instructorId, coverById }: Args): boolean {
  if (coverById !== undefined) return false;
  if (!can(session, "attendance.cover")) return false;
  const me = session.user.id;
  if (instructorId === me) return false;
  return true;
}
