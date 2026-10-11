'use client';

import type { ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { ModuleShell } from '@/components/ui/module-shell';
import { SiteSwitcher } from '@/components/ui/site-switcher';
import { tasksPages } from '@/modules/tasks/features/workspace/pages';
import type { TasksActor } from '@/modules/tasks/shared/access';

/** The pages that show one site: they take it from `?site=` and show the picker. */
const SITE_PAGES = new Set(['/tasks', '/tasks/actions']);

/** Tasks' pages in the shared workspace frame, from its one page list, with the open count on
 *  Actions. The site carries across the one-site pages. */
export function TasksShell({ who, sites, home, openActions, children }: { who: TasksActor; sites: { id: string; name: string }[]; home: string | null; openActions: number; children: ReactNode }) {
  const pathname = usePathname();
  const site = useSearchParams().get('site');
  const keep = (href: string) => (site && SITE_PAGES.has(href) ? `${href}?${new URLSearchParams({ site })}` : href);
  const links = tasksPages(who).map(({ href, label, icon, match }) => ({
    href: keep(href), label: href === '/tasks/actions' && openActions ? `${label} · ${openActions}` : label, icon, active: match(pathname),
  }));
  return (
    <ModuleShell module="Tasks" id="tasks" who={who} links={links} scopeNote="Only the sites you cover"
      tools={SITE_PAGES.has(pathname) && sites.length ? <SiteSwitcher sites={sites} label="Tasks site" clear={['date']} fallback={home} /> : undefined}>
      {children}
    </ModuleShell>
  );
}
