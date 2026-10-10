'use client';

import type { ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { BarChart3, Building2, ClipboardList, Flag, History, LayoutGrid } from 'lucide-react';
import { ModuleShell } from '@/components/ui/module-shell';
import { SiteSwitcher } from '@/components/ui/site-switcher';
import type { TasksActor } from '@/modules/tasks/shared/access';

/** The pages that show one site: they take it from `?site=` and show the picker. */
const SITE_PAGES = new Set(['/tasks', '/tasks/actions']);

/** Tasks' pages in the shared workspace frame, as the prototype named them: Today, Manage tasks,
 *  Reports, Actions (with the open count), Sites and Activity. The site carries across the
 *  one-site pages. */
export function TasksShell({ who, sites, home, openActions, children }: { who: TasksActor; sites: { id: string; name: string }[]; home: string | null; openActions: number; children: ReactNode }) {
  const pathname = usePathname();
  const site = useSearchParams().get('site');
  const keep = (href: string) => (site && SITE_PAGES.has(href) ? `${href}?${new URLSearchParams({ site })}` : href);
  const links = [
    { href: keep('/tasks'), label: 'Today', icon: ClipboardList, active: pathname === '/tasks' || /^\/tasks\/(?!actions|reports|templates|sites|activity)/.test(pathname) },
    ...(who.manage ? [{ href: '/tasks/templates', label: 'Manage tasks', icon: LayoutGrid, active: pathname.startsWith('/tasks/templates') }] : []),
    ...(who.review ? [{ href: '/tasks/reports', label: 'Reports', icon: BarChart3, active: pathname.startsWith('/tasks/reports') }] : []),
    { href: keep('/tasks/actions'), label: openActions ? `Actions · ${openActions}` : 'Actions', icon: Flag, active: pathname.startsWith('/tasks/actions') },
    { href: '/tasks/sites', label: 'Sites', icon: Building2, active: pathname.startsWith('/tasks/sites') },
    ...(who.review ? [{ href: '/tasks/activity', label: 'Activity', icon: History, active: pathname.startsWith('/tasks/activity') }] : []),
  ];
  return (
    <ModuleShell module="Tasks" id="tasks" who={who} links={links} scopeNote="Only the sites you cover"
      tools={SITE_PAGES.has(pathname) && sites.length ? <SiteSwitcher sites={sites} label="Tasks site" clear={['date']} fallback={home} /> : undefined}>
      {children}
    </ModuleShell>
  );
}
