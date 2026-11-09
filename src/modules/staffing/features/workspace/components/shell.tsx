'use client';

import type { ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { ModuleShell } from '@/components/ui/module-shell';
import { SiteSwitcher } from '@/components/ui/site-switcher';
import { staffingPages } from '@/modules/staffing/features/workspace/pages';
import type { StaffingActor } from '@/modules/staffing/shared/access';

/** The pages that show one site: they take it from `?site=` and show the picker. */
const SITE_PAGES = new Set(['/staffing', '/staffing/today', '/staffing/requests', '/staffing/strikes', '/staffing/slots', '/staffing/staff']);

/** Staffing's pages in the shared workspace frame. Set up shows only to Supervise and Manage. */
export function StaffingShell({ who, sites, children }: { who: StaffingActor; sites: { id: string; name: string }[]; children: ReactNode }) {
  const pathname = usePathname();
  const site = useSearchParams().get('site');
  const links = staffingPages()
    .filter((p) => (p.href === '/staffing/strikes' ? who.run : p.place !== 'setup' || who.supervise))
    .filter((p) => !(p.href === '/staffing/seasons' || p.href === '/staffing/settings') || who.manage)
    .map(({ href, label, icon, place, match }) => ({
      href: site && SITE_PAGES.has(href) ? `${href}?${new URLSearchParams({ site })}` : href, label, icon, place, active: match(pathname),
    }));
  return (
    <ModuleShell module="Staffing" id="staffing" who={who} links={links} scopeNote="Only the sites you cover"
      tools={SITE_PAGES.has(pathname) && sites.length ? <SiteSwitcher sites={sites} label="Staffing site" /> : undefined}>
      {children}
    </ModuleShell>
  );
}
