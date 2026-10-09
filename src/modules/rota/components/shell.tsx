'use client';

import type { ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { ModuleShell } from '@/components/workspace/module-shell';
import { rotaPages } from '@/modules/rota/components/pages';
import { SiteSwitcher } from '@/components/workspace/site-switcher';
import type { RotaActor } from '@/modules/rota/lib/access';

/** The pages that show one site: they take the site from `?site=` and show the picker. Overview
 *  (the working site), Absences (everyone the duty manager covers) and the activity list
 *  (the organisation's) do not. */
const SITE_PAGES = new Set(['/rota', '/rota/today', '/rota/bookings']);

/** Rota's navigation in the shared workspace shell, from the one list of its pages. The site
 *  picker sits in the tools, and the site carries across the one-site pages. */
export function RotaShell({ who, sites, children }: { who: RotaActor; sites: { id: string; name: string }[]; children: ReactNode }) {
  const pathname = usePathname();
  const site = useSearchParams().get('site');
  const links = rotaPages(who.run).map(({ href, label, icon, match }) => ({
    href: site && SITE_PAGES.has(href) ? `${href}?${new URLSearchParams({ site })}` : href, label, icon, active: match(pathname),
  }));
  return (
    <ModuleShell module="Rota" id="rota" who={who} links={links} scopeNote="Only the sites you cover"
      tools={SITE_PAGES.has(pathname) && sites.length ? <SiteSwitcher sites={sites} label="Rota site" clear={['dept']} /> : undefined}>
      {children}
    </ModuleShell>
  );
}
