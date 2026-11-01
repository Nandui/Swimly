'use client';

import type { ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { ModuleShell } from '@/components/ui/module-shell';
import { SiteSwitcher } from '@/components/ui/site-switcher';
import { planPages } from '@/modules/plan/features/workspace/pages';

/** Plan (test)'s pages in the shared workspace frame, from its one page list. The site picker
 *  sits in the tools, and the site carries across the one-site pages. */
export function PlanShell({ who, sites, children }: { who: { id: string; name: string }; sites: { id: string; name: string }[]; children: ReactNode }) {
  const pathname = usePathname();
  const site = useSearchParams().get('site');
  const pages = planPages();
  const links = pages.map(({ href, label, icon, match, site: oneSite }) => ({
    href: site && oneSite ? `${href}?${new URLSearchParams({ site })}` : href, label, icon, active: match(pathname),
  }));
  const onSitePage = pages.some((p) => p.site && p.match(pathname));
  return (
    <ModuleShell module="Plan (test)" id="plan" who={who} links={links} scopeNote="Only the sites you cover"
      tools={onSitePage && sites.length ? <SiteSwitcher sites={sites} label="Plan site" clear={['dept']} /> : undefined}>
      {children}
    </ModuleShell>
  );
}
