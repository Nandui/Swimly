'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { FilePenLine, ReceiptText, UserRound } from 'lucide-react';
import { ModuleShell } from '@/components/workspace/module-shell';
import { refundListView, type RefundActor } from '@/modules/refunds/shared/types';

/** Refunds in the shared module frame: its request views along the top. The follow-up queues
 *  are the summary tiles on the list (RefundQueue), so each status has one way in. */
export function RefundShell({ who, children }: {
  who: RefundActor; children: ReactNode;
}) {
  const pathname = usePathname(), query = useSearchParams();
  // A request page, the new-request form and every status view sit under "Refund requests".
  const view = pathname === '/refunds' ? refundListView(query, who.id) : 'requests';
  const requests = [
    { href: '/refunds', label: 'Refund requests', icon: ReceiptText, active: view === 'requests' },
    { href: `/refunds?creator=${encodeURIComponent(who.id)}&status=all`, label: 'My requests', icon: UserRound, active: view === 'mine' },
    ...(who.request ? [{ href: '/refunds?status=DRAFT', label: 'My drafts', icon: FilePenLine, active: view === 'drafts' }] : []),
  ];
  return (
    <ModuleShell module="Refunds" id="refunds" who={who} scopeNote="Your team's space"
      links={requests}
      contentClass="refund-content" scrollKey={query.toString()}>
      {children}
    </ModuleShell>
  );
}
