'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { ModuleShell } from '@/components/ui/module-shell';
import { monitoringPages } from '@/modules/site-monitoring/features/workspace/pages';

/** Site Monitoring's pages in the shared workspace frame, from its one page list. */
export function MonitoringShell({ who, children }: { who: { id: string; name: string }; children: ReactNode }) {
  const pathname = usePathname();
  const links = monitoringPages().map(({ href, label, icon, match }) => ({ href, label, icon, active: match(pathname) }));
  return (
    <ModuleShell module="Site Monitoring" id="site-monitoring" who={who} links={links} scopeNote="Only the sites you cover">
      {children}
    </ModuleShell>
  );
}
