'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { ModuleShell } from '@/components/ui/module-shell';
import { hrPages } from '@/modules/hr/features/workspace/pages';
import type { HrActor } from '@/modules/hr/shared/access';

/** HR's navigation in the shared workspace shell, from its one page list. */
export function HrShell({ who, children }: { who: HrActor; children: ReactNode }) {
  const pathname = usePathname();
  const links = hrPages(who).map(({ href, label, icon, match }) => ({ href, label, icon, active: match(pathname) }));
  return (
    <ModuleShell module="HR" id="hr" who={who} links={links} scopeNote="Restricted · every read is logged">
      {children}
    </ModuleShell>
  );
}
