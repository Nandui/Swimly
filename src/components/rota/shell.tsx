'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { CalendarDays, UserX } from 'lucide-react';
import { ModuleShell } from '@/components/workspace/module-shell';
import type { RotaActor } from '@/lib/rota/access';

/** Rota's navigation in the shared workspace shell. Absences are for rota managers. */
export function RotaShell({ who, initialCollapsed = false, children }: { who: RotaActor; initialCollapsed?: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const links = [
    { href: '/rota', label: 'Week', icon: CalendarDays, active: pathname === '/rota' },
    ...(who.manage ? [{ href: '/rota/absences', label: 'Absences', icon: UserX, active: pathname.startsWith('/rota/absences') }] : []),
  ];
  return (
    <ModuleShell module="Rota" id="rota" who={who} pageLabel={links.find((l) => l.active)?.label ?? 'Week'} initialCollapsed={initialCollapsed}
      links={links} scopeNote="Only the sites you cover">
      {children}
    </ModuleShell>
  );
}
