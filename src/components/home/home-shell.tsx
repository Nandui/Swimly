'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { UserRound } from 'lucide-react';
import { ClubSwitcher } from '@/components/clubs/club-switcher';
import { ModuleShell } from '@/components/workspace/module-shell';

type Site = { id: string; name: string };

/** The home page in the shared frame: "Your modules" down the side, exactly
 *  what the role has; every module page enforces its own access again. The
 *  working site's picker sits in the tools, as in every module. `account`
 *  frames the person's own Account page (/account): Home stays current in the
 *  rail and the bar holds the one "Account" pill. On the home page the bar is
 *  Today and then the swim school's daily pages (`pages`), and `tools` are the
 *  composition root's search and site picker. */
export function HomeShell({ who, sites, account = false, tools, pages = [], children }: {
  who: { id: string; name: string };
  sites: { club: Site; clubs: Site[] } | null;
  account?: boolean;
  /** Replaces the plain site picker, e.g. with the swim school's search and picker. */
  tools?: ReactNode;
  /** The daily pages after Today, as plain links (a one-link bar is not shown). */
  pages?: { href: string; label: string }[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const home = pages.length ? [{ href: '/', label: 'Today', active: pathname === '/' }, ...pages.map((page) => ({ ...page, active: false }))] : undefined;
  return (
    <ModuleShell module={account ? "Account" : "Home"} id="home" current="home" who={who}
      scopeNote={account ? "Only you" : "Only what your role can open"}
      links={account ? [{ href: '/account', label: 'Account', icon: UserRound, active: true }] : home}
      tools={tools ?? (sites ? <ClubSwitcher club={sites.club} clubs={sites.clubs} /> : undefined)}>
      {children}
    </ModuleShell>
  );
}
