'use client';

import type { ReactNode } from 'react';
import { ClubSwitcher } from '@/components/ui/club-switcher';
import { ModuleShell } from '@/components/ui/module-shell';

type Site = { id: string; name: string };

/** Home in the shared frame: "Your modules" down the side, exactly what the role has; every
 *  module page enforces its own access again. Home has no page bar, and the working site's
 *  picker sits in the tools, as in every module. `account` frames the person's own Account
 *  page (/account): Home stays current in the rail and the H1 names the page. */
export function HomeShell({ who, sites, account = false, children }: {
  who: { id: string; name: string };
  sites: { club: Site; clubs: Site[] } | null;
  account?: boolean;
  children: ReactNode;
}) {
  return (
    <ModuleShell module={account ? "Account" : "Home"} id="home" current="home" who={who}
      scopeNote={account ? "Only you" : "Only what your role can open"}
      tools={sites ? <ClubSwitcher club={sites.club} clubs={sites.clubs} /> : undefined}>
      {children}
    </ModuleShell>
  );
}
