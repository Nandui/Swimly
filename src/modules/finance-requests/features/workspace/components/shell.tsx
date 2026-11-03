'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { ModuleShell } from '@/components/ui/module-shell';
import { financePages, type FinanceView } from '@/modules/finance-requests/features/workspace/pages';
import type { FinanceActor } from '@/modules/finance-requests/shared/access';
import { coinageListView } from '@/modules/finance-requests/shared/coinage/types';
import { refundListView } from '@/modules/finance-requests/shared/refunds/types';

/** Finance requests in the shared module frame: its overview and both kinds' request views, from
 *  its one page list. The follow-up queues are the summary tiles on each list, so each status
 *  has one way in. */
export function FinanceShell({ who, contentClass, children }: { who: FinanceActor; contentClass?: string; children: ReactNode }) {
  const pathname = usePathname(), query = useSearchParams();
  // A request page, the new-request form and every status view sit under that kind's requests.
  const view: FinanceView = pathname === '/finance-requests' ? 'overview'
    : pathname === '/refunds' ? `refunds:${refundListView(query, who.id)}`
    : pathname.startsWith('/refunds') ? 'refunds:requests'
    : pathname === '/coinage' ? `coinage:${coinageListView(query, who.id)}`
    : 'coinage:requests';
  const links = financePages(who).map(({ href, label, icon, place, view: page }) => ({ href, label, icon, place, active: page === view }));
  return (
    <ModuleShell module="Finance requests" id="finance-requests" who={who} scopeNote="Your team's space" links={links} contentClass={contentClass} scrollKey={query.toString()}>
      {children}
    </ModuleShell>
  );
}
