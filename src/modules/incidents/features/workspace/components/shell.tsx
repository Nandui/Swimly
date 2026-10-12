'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { ModuleShell } from '@/components/ui/module-shell';
import { incidentPages } from '@/modules/incidents/features/workspace/pages';
import type { IncidentsActor } from '@/modules/incidents/shared/types';

/** Incidents' pages in the shared workspace frame, from its one page list. */
export function IncidentsShell({ who, children }: { who: IncidentsActor; children: ReactNode }) {
  const pathname = usePathname();
  const links = incidentPages(who).map(({ href, label, icon, match }) => ({ href, label, icon, active: match(pathname) }));
  return (
    <ModuleShell module="Incidents" id="incidents" who={who} links={links} scopeNote="Only the sites you cover">
      {children}
    </ModuleShell>
  );
}
