import type { ReactNode } from "react";
import { InstructorShell } from "@/modules/activities/features/instructor";
import { screenPage } from "@/lib/page-guards";
import { getCurrentClub } from "@/lib/clubs/current";
import { can } from "@/lib/authz";

export default async function InstructorLayout({ children }: { children: ReactNode }) {
  const session = await screenPage("instructor", "attendance.mark");
  const { club, clubs } = await getCurrentClub();
  return <InstructorShell who={{ id: session.user.id, name: session.user.name ?? "Instructor" }} club={club} clubs={clubs} shortCourses={can(session, "short-courses.run")}>{children}</InstructorShell>;
}
