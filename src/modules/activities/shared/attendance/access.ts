import type { Session } from "next-auth";
import { can } from "@/lib/authz";

/** Teaching requires a confirmed start for this class and date. Scheduled
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

/** Once started, any permitted instructor can help with the session.
 * A null actor still represents a start by a subsequently deleted account. */
export function canTeachClass({ session, coverById }: Args): boolean {
  if (!can(session, "attendance.mark")) return false;
  return coverById !== undefined;
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
