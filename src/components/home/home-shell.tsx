'use client';

import type { ReactNode } from 'react';
import { ClubSwitcher } from '@/components/ui/club-switcher';
import { ModuleShell } from '@/components/ui/module-shell';

type Site = { id: string; name: string };

/** Home in the shared frame: "Your modules" down the side, exactly what the role has; every
 *  module page enforces its own access again. Home has no page bar, and the working site's
 *  picker sits in the tools, as in every module. `page` frames a page of the person's own
 *  that is not a module (Account, What's new): Home stays current in the rail and the H1
 *  names the page. */
export function HomeShell({ who, sites, page, children }: {
  who: { id: string; name: string };
  sites: { club: Site; clubs: Site[] } | null;
  page?: { name: string; scope: string };
  children: ReactNode;
}) {
  return (
    <ModuleShell module={page?.name ?? "Home"} id="home" current="home" who={who}
      scopeNote={page?.scope ?? "Only what your role can open"}
      tools={sites ? <ClubSwitcher club={sites.club} clubs={sites.clubs} /> : undefined}>
      {children}
    </ModuleShell>
  );
}
