"use client";

import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { ClubSwitcher } from "@/components/ui/club-switcher";
import { ModuleShell } from "@/components/ui/module-shell";
import { WorkspaceSearch } from "@/modules/activities/shared/students/components/workspace-search";
import { isNavItemActive, swimmerLookupHref, visibleNavGroups } from "@/modules/activities/features/workspace/server/nav";
import type { ScreenKey } from "@/lib/staff/screens";
import { LayoutDashboard } from "lucide-react";

/** The swim school's first page (`src/app/(activities)/swim-school`). */
const SWIM_SCHOOL_OVERVIEW = "/swim-school";

type Club = { id: string; name: string };

/** The swim school in the shared module frame (docs/how-turnfin-works.md):
 *  its desk pages along the top, then swimmer search and the working site in
 *  the tools bar. The layout passes plain values; the icons come from
 *  `@/modules/activities/features/workspace/server/nav`, because a component is not serialisable. */
export function AppChrome({ who, screens, club, clubs, children }: {
  who: { id: string; name: string };
  /** The screens this person can open, already resolved against their role. */
  screens: Set<ScreenKey>;
  club: Club;
  clubs: Club[];
  children: ReactNode;
}) {
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
      scopeNote={club.name} contentClass="module-content swim-school-content"
      tools={<SwimSchoolTools screens={screens} club={club} clubs={clubs} />}>
      {children}
    </ModuleShell>
  );
}

/** The swim school's top-bar tools: swimmer search for those who can open Swimmers, then the
 *  working site. The swim school's frame and the home page both use them. */
export function SwimSchoolTools({ screens, club, clubs }: { screens: Set<ScreenKey>; club: Club; clubs: Club[] }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <>
      {screens.has("students") && <WorkspaceSearch key={`${club.id}:${pathname}`} onSelect={hit => {
        if (!hit) return;
        const href = swimmerLookupHref(screens, hit.id);
        if (href) router.push(href);
      }} />}
      <ClubSwitcher club={club} clubs={clubs} />
    </>
  );
}
