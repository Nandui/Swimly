import type { ReactNode } from "react";
import { InstructorShell } from "@/components/instructor/instructor-shell";
import { DevelopmentRolePreview } from "@/components/staff/development-role-preview";
import { screenPage } from "@/lib/page-guards";
import { getCurrentClub } from "@/lib/clubs/current";

export default async function InstructorLayout({ children }: { children: ReactNode }) {
  const session = await screenPage("instructor", "attendance.mark");
  const { club, clubs } = await getCurrentClub();
  return <InstructorShell userName={session.user.name ?? "Instructor"} club={club} clubs={clubs}
    banner={<DevelopmentRolePreview session={session} />}>{children}</InstructorShell>;
}
