'use client';

import type { ReactNode } from 'react';
import { ClubSwitcher } from '@/components/clubs/club-switcher';
import { ModuleShell } from '@/components/workspace/module-shell';

type Site = { id: string; name: string };

/** The home page in the shared frame: "Your modules" down the side, exactly
 *  what the role has; every module page enforces its own access again. The
 *  working site's picker sits in the tools, as in every module. */
export function HomeShell({ who, sites, children }: {
  who: { id: string; name: string };
  sites: { club: Site; clubs: Site[] } | null;
  children: ReactNode;
}) {
  return (
    <ModuleShell module="Home" id="home" current="home" who={who} scopeNote="Only what your role can open"
      tools={sites ? <ClubSwitcher club={sites.club} clubs={sites.clubs} /> : undefined}>
      {children}
    </ModuleShell>
  );
}
