'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Building2, History, KeyRound, LayoutDashboard, Users, type LucideIcon } from 'lucide-react';
import { ModuleShell } from '@/components/workspace/module-shell';

export type CoreLinkKey = 'staff' | 'roles' | 'clubs' | 'activity';

const LINKS: { key: CoreLinkKey; href: string; label: string; icon: LucideIcon }[] = [
  { key: 'staff', href: '/staff', label: 'Staff', icon: Users },
  { key: 'roles', href: '/roles', label: 'Roles', icon: KeyRound },
  { key: 'clubs', href: '/clubs', label: 'Sites', icon: Building2 },
  { key: 'activity', href: '/activity', label: 'Activity', icon: History },
];

/** Turnfin Core: the organisation itself (people, roles, sites, the activity
 *  log). It belongs to no module, so Aquatics, Docs and the rest all rely on
 *  it without owning it. Each person's own Account is not here: it lives at
 *  /account under the Home frame. Links follow the screens this person can
 *  open; every page checks again. Keep the icons in step with core/page.tsx. */
export function CoreShell({ who, screens, children }: {
  who: { id: string; name: string };
  screens: CoreLinkKey[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isOn = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const links = [
    { href: '/core', label: 'Overview', icon: LayoutDashboard, active: pathname === '/core' },
    ...LINKS.filter((link) => screens.includes(link.key)).map(({ href, label, icon }) => ({ href, label, icon, active: isOn(href) })),
  ];
  return (
    <ModuleShell module="Admin" id="core" current="admin" who={who} links={links} scopeNote="Shared by every module">
      {children}
    </ModuleShell>
  );
}
