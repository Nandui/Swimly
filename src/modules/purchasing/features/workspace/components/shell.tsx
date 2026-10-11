'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { ModuleShell } from '@/components/ui/module-shell';
import { purchasingPages } from '@/modules/purchasing/features/workspace/pages';
import type { PurchasingActor } from '@/modules/purchasing/shared/access';

/** Purchasing's pages in the shared workspace frame, from its one page list. */
export function PurchasingShell({ who, children }: { who: PurchasingActor; children: ReactNode }) {
  const pathname = usePathname();
  const links = purchasingPages(who).map(({ href, label, icon, match }) => ({ href, label, icon, active: match(pathname) }));
  return (
    <ModuleShell module="Purchasing" id="purchasing" who={who} links={links} scopeNote="Only the sites you cover">
      {children}
    </ModuleShell>
  );
}
