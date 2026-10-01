'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { CalendarDays, Clock3, LayoutDashboard, UserX } from 'lucide-react';
import { ModuleShell } from '@/components/workspace/module-shell';
import type { RotaActor } from '@/lib/rota/access';

/** Rota's navigation in the shared workspace shell. Absences are for rota managers. */
export function RotaShell({ who, initialCollapsed = false, children }: { who: RotaActor; initialCollapsed?: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const links = [
    { href: '/rota/overview', label: 'Overview', icon: LayoutDashboard, active: pathname === '/rota/overview' },
    { href: '/rota', label: 'Week plan', icon: CalendarDays, active: pathname === '/rota' },
    { href: '/rota/today', label: 'Today', icon: Clock3, active: pathname.startsWith('/rota/today') },
    ...(who.manage ? [
      { href: '/rota/absences', label: 'Absences', icon: UserX, active: pathname.startsWith('/rota/absences') },
    ] : []),
  ];
  return (
    <ModuleShell module="Rota" id="rota" base="/rota/overview" who={who} pageLabel={links.find((l) => l.active)?.label ?? 'Week'} initialCollapsed={initialCollapsed}
      links={links} scopeNote="Only the sites you cover">
      {children}
    </ModuleShell>
  );
}
