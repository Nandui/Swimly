'use client';

import type { ReactNode } from 'react';
import { CalendarDays, UserRound } from 'lucide-react';
import { ModuleShell } from '@/components/workspace/module-shell';
import type { RotaActor } from '@/lib/rota/access';

/** Rota's navigation. */
export function RotaShell({ who, initialCollapsed = false, children }: { who: RotaActor; initialCollapsed?: boolean; children: ReactNode }) {
  return (
    <ModuleShell module="Rota" home="/rota" who={who} initialCollapsed={initialCollapsed}
      links={[{ href: '/rota', label: 'Week', icon: CalendarDays }]}
      yours={{ href: '/me/shifts', label: 'My shifts', icon: UserRound }}>
      {children}
    </ModuleShell>
  );
}
