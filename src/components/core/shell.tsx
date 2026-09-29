'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Activity, Building2, KeyRound, LayoutDashboard, UserCog, UserRound, type LucideIcon } from 'lucide-react';
import { ModuleShell } from '@/components/workspace/module-shell';

export type CoreLinkKey = 'staff' | 'roles' | 'clubs' | 'activity';

const LINKS: { key: CoreLinkKey; href: string; label: string; icon: LucideIcon }[] = [
  { key: 'staff', href: '/staff', label: 'Staff', icon: UserCog },
  { key: 'roles', href: '/roles', label: 'Roles', icon: KeyRound },
  { key: 'clubs', href: '/clubs', label: 'Clubs', icon: Building2 },
  { key: 'activity', href: '/activity', label: 'Activity', icon: Activity },
];

/** Turnfin Core: the organisation itself (people, roles, sites, the activity
 *  log) and each person's account. It belongs to no module, so Aquatics,
 *  Docs and the rest all rely on it without owning it. Links follow the
 *  screens this person can open; every page checks again. */
export function CoreShell({ who, screens, initialCollapsed = false, children }: {
  who: { id: string; name: string };
  screens: CoreLinkKey[];
  initialCollapsed?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isOn = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const links = [
    { href: '/core', label: 'Overview', icon: LayoutDashboard, active: pathname === '/core' },
    ...LINKS.filter((link) => screens.includes(link.key)).map(({ href, label, icon }) => ({ href, label, icon, active: isOn(href) })),
    { href: '/account', label: 'Account', icon: UserRound, active: isOn('/account') },
  ];
  const pageLabel = links.find((link) => link.active)?.label ?? 'Admin';
  return (
    <ModuleShell module="Admin" id="core" current="admin" base="/core" who={who} links={links} pageLabel={pageLabel} initialCollapsed={initialCollapsed} scopeNote="Shared by every module">
      {children}
    </ModuleShell>
  );
}
