import { notFound } from "next/navigation";
import { can, canSee } from "@/lib/authz";
import { pageSession } from "@/lib/page-guards";
import type { ClassWorkspace } from "@/modules/activities/shared/attendance/navigation";

/** An Aquatics class page exists only in the workspace the person may use.
 *  Sharing attendance forms does not grant access to the other workspace:
 *  the deck needs the Instructor screen, the desk needs Schedule or Classes,
 *  and both need permission to take attendance. */
export async function classPage(workspace: ClassWorkspace) {
  const session = await pageSession();
  const offered = workspace === "instructor"
    ? canSee(session, "instructor")
    : canSee(session, "calendar") || canSee(session, "courses");
  if (!offered || !can(session, "attendance.mark")) notFound();
  return session;
}
