'use client';

import type { ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { BarChart3, ClipboardCheck, Flag, LayoutList } from 'lucide-react';
import { ModuleShell } from '@/components/workspace/module-shell';
import { SiteSwitcher } from '@/components/workspace/site-switcher';
import type { TasksActor } from '@/lib/tasks/access';

/** The pages that show one site: they take it from `?site=` and show the picker. */
const SITE_PAGES = new Set(['/tasks', '/tasks/actions']);

/** Tasks' pages in the shared workspace frame. The site carries across the one-site pages. */
export function TasksShell({ who, sites, home, children }: { who: TasksActor; sites: { id: string; name: string }[]; home: string | null; children: ReactNode }) {
  const pathname = usePathname();
  const site = useSearchParams().get('site');
  const keep = (href: string) => (site && SITE_PAGES.has(href) ? `${href}?${new URLSearchParams({ site })}` : href);
  const links = [
    { href: keep('/tasks'), label: 'Today', icon: ClipboardCheck, active: pathname === '/tasks' || /^\/tasks\/(?!actions|reports|templates)/.test(pathname) },
    { href: keep('/tasks/actions'), label: 'Actions', icon: Flag, active: pathname.startsWith('/tasks/actions') },
    ...(who.review ? [{ href: '/tasks/reports', label: 'Reports', icon: BarChart3, active: pathname.startsWith('/tasks/reports') }] : []),
    ...(who.manage ? [{ href: '/tasks/templates', label: 'Templates', icon: LayoutList, active: pathname.startsWith('/tasks/templates') }] : []),
  ];
  return (
    <ModuleShell module="Tasks" id="tasks" who={who} links={links} scopeNote="Only the sites you cover"
      tools={SITE_PAGES.has(pathname) && sites.length ? <SiteSwitcher sites={sites} label="Tasks site" clear={['date']} fallback={home} /> : undefined}>
      {children}
    </ModuleShell>
  );
}
