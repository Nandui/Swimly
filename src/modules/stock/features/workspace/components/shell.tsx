'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { ModuleShell } from '@/components/ui/module-shell';
import { stockPages } from '@/modules/stock/features/workspace/pages';
import type { StockActor } from '@/modules/stock/shared/access';

/** Stock's pages in the shared workspace frame, from its one page list. */
export function StockShell({ who, children }: { who: StockActor; children: ReactNode }) {
  const pathname = usePathname();
  const links = stockPages().map(({ href, label, icon, match }) => ({ href, label, icon, active: match(pathname) }));
  return (
    <ModuleShell module="Stock" id="stock" who={who} links={links} scopeNote="Only the sites you cover">
      {children}
    </ModuleShell>
  );
}
