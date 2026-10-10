'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { ADMIN_GROUPS, type CoreLinkKey } from '@/components/core/pages';
import { ModuleShell } from '@/components/ui/module-shell';

export type { CoreLinkKey };

/** Turnfin Core, the Admin module: the organisation itself and the setup every module shares,
 *  grouped by topic (owner decision, 7 October 2026): People, Places, Work and the log. Each
 *  person's own Account is not here: it lives at /account under the Home frame. Links follow
 *  the screens this person can open; every page checks again. */
export function CoreShell({ who, screens, children }: {
  who: { id: string; name: string };
  screens: CoreLinkKey[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isOn = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const groups = [
    { label: '', links: [{ href: '/core', label: 'Overview', icon: ADMIN_GROUPS[0].links[0].icon, active: pathname === '/core' }] },
    ...ADMIN_GROUPS.slice(1).map((g) => ({
      label: g.label,
      links: g.links.filter((l) => screens.includes(l.key as CoreLinkKey)).map(({ href, label, icon }) => ({ href, label, icon, active: isOn(href) })),
    })).filter((g) => g.links.length),
  ];
  return (
    <ModuleShell module="Admin" id="core" current="admin" who={who} groups={groups} scopeNote="Shared by every module">
      {children}
    </ModuleShell>
  );
}
