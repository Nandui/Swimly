import "server-only";
import { AuthorizationError, requireSession } from "@/lib/authz";
import { activeStaffCovered } from "@/lib/people/records";
import { subjectsFor } from "@/lib/policy/session";
import { hrAccess } from "@/modules/hr/shared/access";

/** The people this person may report on: those they manage (HR Report), or
 *  everyone their files reach. Names and job titles only, so no HR record is
 *  read and nothing needs a fresh sign-in or an access-log row. Nobody reports
 *  on themselves. */
export async function reportablePeople(query = "") {
  const who = hrAccess(await requireSession());
  if (!who?.reports) throw new AuthorizationError("HR access is required.");
  const scope = await subjectsFor("hr.reports.write");
  const people = await activeStaffCovered(who.orgId || null, scope, query.trim().slice(0, 80), 30);
  return { who, people: people.filter((p) => p.id !== who.id) };
}
