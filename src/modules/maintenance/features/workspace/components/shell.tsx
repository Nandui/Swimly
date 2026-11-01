'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { ModuleShell } from '@/components/ui/module-shell';
import { maintenancePages } from '@/modules/maintenance/features/workspace/pages';

/** Maintenance in the shared module frame: its pages along the top, from its one page list. A
 *  request's page and every list view other than Yours sit under Requests. */
export function MaintenanceShell({ who, children }: { who: { id: string; name: string }; children: ReactNode }) {
  const pathname = usePathname(), query = useSearchParams();
  const view = pathname === '/maintenance/overview' ? 'overview' : pathname === '/maintenance/new' ? 'new' : pathname === '/maintenance' && query.get('show') === 'mine' ? 'mine' : 'requests';
  const links = maintenancePages().map(({ href, label, icon, view: page }) => ({ href, label, icon, active: page === view }));
  return (
    <ModuleShell module="Maintenance" id="maintenance" who={who} scopeNote="Your sites" links={links} scrollKey={query.toString()}>
      {children}
    </ModuleShell>
  );
}
