import type { TagColor } from "@/components/ui-kit/tag";
import type { Role } from "@/generated/prisma/client";

/** One map per enum. Call sites read the label and the tint from here and
 *  never write either inline — so adding a role to the schema is a type error
 *  until it has both, which is how the untinted status gets caught by the
 *  compiler instead of by a reviewer. */
export const ROLE_META: Record<Role, { label: string; color: TagColor }> = {
  ADMIN: { label: "Admin", color: "purple" },
  INSTRUCTOR: { label: "Instructor", color: "blue" },
  VIEWER: { label: "Viewer", color: "gray" },
};

/** What each role may do, in the words the person choosing one needs. The
 *  tiers are the authority (`src/lib/authz.ts`); this is how they read. */
export const ROLE_BLURB: Record<Role, string> = {
  ADMIN: "Everything, including the timetable, the curriculum and these accounts.",
  INSTRUCTOR: "Registers, assessments, students and enrolments. Not the curriculum.",
  VIEWER: "Can look things up and change nothing. Reception, or a duty manager.",
};

/** The order roles are offered in: least access first, so the powerful one is
 *  a deliberate reach rather than the thing the cursor lands on. */
export const ROLE_ORDER: Role[] = ["VIEWER", "INSTRUCTOR", "ADMIN"];

/** Long enough to be worth having, short enough to read down a phone. The
 *  same floor applies to an admin setting a temporary one and to a person
 *  choosing their own, because the temporary one is a real key until it is
 *  changed. */
export const MIN_PASSWORD_LENGTH = 12;
