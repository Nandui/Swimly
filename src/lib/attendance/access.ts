import type { Session } from "next-auth";
import { can } from "@/lib/authz";

/** Who may take a given register.
 *
 *  The scoping rule sits here rather than in the permission catalogue, because
 *  "their own classes" is a fact about the row being marked, not about the
 *  person. What the catalogue carries is the two-step: `attendance.mark` marks
 *  the classes you teach, `attendance.markAny` marks anybody's.
 *
 *  A class with nobody assigned needs `attendance.markAny`. Cover staff go
 *  through a reassignment, which is deliberate and leaves a record — or
 *  through a role that holds `attendance.markAny`, which is the reason that
 *  permission exists separately at all. */
export function canMarkRegister(args: {
  session: Session;
  instructorId: string | null;
}): boolean {
  if (can(args.session, "attendance.markAny")) return true;
  if (!can(args.session, "attendance.mark")) return false;
  return args.instructorId !== null && args.instructorId === args.session.user.id;
}
