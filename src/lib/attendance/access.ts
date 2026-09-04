import type { Session } from "next-auth";
import { can } from "@/lib/authz";

/** Who may take a given register, and sign off the class's checklist.
 *
 *  The scoping rule sits here rather than in the permission catalogue, because
 *  "their own classes" is a fact about the row being marked, not about the
 *  person. What the catalogue carries is the two-step: `attendance.mark` marks
 *  the classes you teach, `attendance.markAny` marks anybody's.
 *
 *  Cover is the third way in. Somebody with `attendance.mark` standing at a
 *  class that is not theirs — another instructor's, or nobody's — takes it
 *  over for the day, and that day's `ClassCover` row makes it theirs to mark.
 *  It used to need an admin to reassign the course; now it needs the person
 *  to say so, and the register to record it. */

type Args = {
  session: Session;
  instructorId: string | null;
  /** Who has taken the class over on the date in question, if anyone. */
  coverById?: string | null;
};

export function canMarkRegister({ session, instructorId, coverById }: Args): boolean {
  if (can(session, "attendance.markAny")) return true;
  if (!can(session, "attendance.mark")) return false;
  const me = session.user.id;
  return instructorId === me || (coverById != null && coverById === me);
}

/** Whether this person should be asked if they are taking the class: it is
 *  somebody else's, or nobody's, and they have not already said so. True
 *  even for someone who may mark any register — the question is about who
 *  conducted the class, not about permission — and they are offered the
 *  answer "just recording it for the instructor". */
export function needsTakeOver({ session, instructorId, coverById }: Args): boolean {
  if (!can(session, "attendance.mark")) return false;
  const me = session.user.id;
  if (instructorId === me) return false;
  if (coverById != null && coverById === me) return false;
  return true;
}
