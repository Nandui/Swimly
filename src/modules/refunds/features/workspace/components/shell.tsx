'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { ModuleShell } from '@/components/ui/module-shell';
import { refundPages } from '@/modules/refunds/features/workspace/pages';
import { refundListView, type RefundActor } from '@/modules/refunds/shared/types';

/** Refunds in the shared module frame: its overview and request views along the top, from its
 *  one page list. The follow-up queues are the summary tiles on the list (RefundQueue), so each
 *  status has one way in. */
export function RefundShell({ who, children }: {
  who: RefundActor; children: ReactNode;
}) {
  const pathname = usePathname(), query = useSearchParams();
  // A request page, the new-request form and every status view sit under "Refund requests".
  const view = pathname === '/refunds/overview' ? 'overview' : pathname === '/refunds' ? refundListView(query, who.id) : 'requests';
  const requests = refundPages(who).map(({ href, label, icon, view: page }) => ({ href, label, icon, active: page === view }));
  return (
    <ModuleShell module="Refunds" id="refunds" who={who} scopeNote="Your team's space"
      links={requests}
      contentClass="refund-content" scrollKey={query.toString()}>
      {children}
    </ModuleShell>
  );
}
