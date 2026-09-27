'use client';

import type { ReactNode } from 'react';
import { CalendarDays, UserRound } from 'lucide-react';
import { ModuleShell } from '@/components/workspace/module-shell';
import type { RotaActor } from '@/lib/rota/access';

/** Rota's navigation in the shared workspace shell. */
export function RotaShell({ who, initialCollapsed = false, children }: { who: RotaActor; initialCollapsed?: boolean; children: ReactNode }) {
  return (
    <ModuleShell module="Rota" id="rota" who={who} pageLabel="Week" initialCollapsed={initialCollapsed}
      links={[{ href: '/rota', label: 'Week', icon: CalendarDays, active: true }]}
      yours={{ href: '/me/shifts', label: 'My shifts', icon: UserRound }} scopeNote="Only the sites you cover">
      {children}
    </ModuleShell>
  );
}
