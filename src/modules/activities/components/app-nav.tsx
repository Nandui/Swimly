"use client";

import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { ClubSwitcher } from "@/components/clubs/club-switcher";
import { ModuleShell } from "@/components/workspace/module-shell";
import { WorkspaceSearch } from "@/modules/activities/components/students/workspace-search";
import { isNavItemActive, pageWidthFor, swimmerLookupHref, visibleNavGroups } from "@/modules/activities/lib/nav";
import type { ScreenKey } from "@/lib/staff/screens";
import { LayoutDashboard } from "lucide-react";

/** The swim school's first page (`src/app/(activities)/swim-school`). */
const SWIM_SCHOOL_OVERVIEW = "/swim-school";

type Club = { id: string; name: string };

/** The swim school in the shared module frame (docs/how-turnfin-works.md):
 *  its desk pages along the top, then swimmer search and the working site in
 *  the tools bar. The layout passes plain values; the icons come from
 *  `@/modules/activities/lib/nav`, because a component is not serialisable. */
export function AppChrome({ who, screens, club, clubs, children }: {
  who: { id: string; name: string };
  /** The screens this person can open, already resolved against their role. */
  screens: Set<ScreenKey>;
  club: Club;
  clubs: Club[];
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const groups = [
    { label: "", links: [{ href: SWIM_SCHOOL_OVERVIEW, label: "Overview", icon: LayoutDashboard, active: pathname === SWIM_SCHOOL_OVERVIEW }] },
    ...visibleNavGroups(screens).map(group => ({
      label: group.label,
      links: group.items.map(item => ({ href: item.href, label: item.label, icon: item.icon, active: isNavItemActive(pathname, item.href) })),
    })),
  ];
  return (
    <ModuleShell module="Swim school" id="swim-school" who={who} groups={groups}
      scopeNote={club.name} contentClass="module-content swim-school-content" maxWidth={pageWidthFor(pathname)}
      tools={<>
        {screens.has("students") && <WorkspaceSearch key={`${club.id}:${pathname}`} onSelect={hit => {
          if (!hit) return;
          const href = swimmerLookupHref(screens, hit.id);
          if (href) router.push(href);
        }} />}
        <ClubSwitcher club={club} clubs={clubs} />
      </>}>
      {children}
    </ModuleShell>
  );
}
