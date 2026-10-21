'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { ModuleShell } from '@/components/ui/module-shell';
import { coinagePages } from '@/modules/coinage/features/workspace/pages';
import { coinageListView, type CoinageActor } from '@/modules/coinage/shared/types';

/** Coinage in the shared module frame: its overview and request views along the top, from its
 *  one page list. The follow-up queues are the summary tiles on the list (CoinageQueue). */
export function CoinageShell({ who, children }: { who: CoinageActor; children: ReactNode }) {
  const pathname = usePathname(), query = useSearchParams();
  // A request page, the new-request form and every status view sit under "Coinage requests".
  const view = pathname === '/coinage/overview' ? 'overview' : pathname === '/coinage' ? coinageListView(query, who.id) : 'requests';
  const links = coinagePages(who).map(({ href, label, icon, view: page }) => ({ href, label, icon, active: page === view }));
  return (
    <ModuleShell module="Coinage" id="coinage" who={who} scopeNote="Your team's space" links={links} scrollKey={query.toString()}>
      {children}
    </ModuleShell>
  );
}
