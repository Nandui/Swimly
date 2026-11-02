"use client";

import type { ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { CalendarCheck, Users } from "lucide-react";
import { ClubSwitcher } from "@/components/ui/club-switcher";
import { ModuleShell } from "@/components/ui/module-shell";
import { instructorHomeHref } from "@/modules/activities/shared/attendance/navigation";
import styles from "@/modules/activities/features/instructor/components/instructor-shell.module.css";

type Club = { id: string; name: string };

/** The pool deck in the shared frame (D19: one shell for every app), with its two pages, Classes
 *  and Swimmers, in the sidebar and the working site in the tools. A swim teacher who holds only
 *  the pool deck sees nothing else. Its swimmer lookup covers only the working site and shows
 *  medical notes only for swimmers the instructor teaches. The deck's own wrapper keeps its
 *  controls thumb-sized at tablet widths. */
export function InstructorShell({ children, who, club, clubs }: {
  children: ReactNode;
  who: { id: string; name: string };
  club: Club;
  clubs: Club[];
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const home = instructorHomeHref({ tab: params.get("tab") ?? undefined, group: params.get("group") ?? undefined });
  const onSwimmers = pathname === "/instructor/swimmers";
  return (
    <ModuleShell module="Pool deck" id="pool-deck" who={who} scopeNote={club.name} scrollKey={params.toString()}
      links={[
        { href: home, label: "Classes", icon: CalendarCheck, active: !onSwimmers },
        { href: "/instructor/swimmers", label: "Swimmers", icon: Users, active: onSwimmers },
      ]}
      tools={<ClubSwitcher club={club} clubs={clubs} touchTargets />}>
      <div className={styles.workspace}>{children}</div>
    </ModuleShell>
  );
}
