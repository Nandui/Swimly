'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { FilePenLine, ReceiptText, UserRound } from 'lucide-react';
import { ModuleShell } from '@/components/workspace/module-shell';
import type { RefundActor } from '@/lib/refunds/types';

/** Refunds in the shared module frame: its request views along the top. The follow-up queues
 *  are the summary tiles on the list (RefundQueue), so each status has one way in. */
export function RefundShell({ who, children }: {
  who: RefundActor; children: ReactNode;
}) {
  const pathname = usePathname(), query = useSearchParams();
  const onList = pathname === '/refunds';
  const selectedStatus = query.get('status');
  const myRequests = query.get('creator') === who.id;
  const requests = [
    { href: '/refunds', label: 'Refund requests', icon: ReceiptText, active: onList && !myRequests && (!selectedStatus || ['all', 'open', 'actionable', 'IN_REVIEW', 'DECLINED', 'WITHDRAWN'].includes(selectedStatus)) },
    { href: `/refunds?creator=${encodeURIComponent(who.id)}&status=all`, label: 'My requests', icon: UserRound, active: onList && myRequests && selectedStatus !== 'DRAFT' },
    ...(who.request ? [{ href: '/refunds?status=DRAFT', label: 'My drafts', icon: FilePenLine, active: onList && selectedStatus === 'DRAFT' }] : []),
  ];
  return (
    <ModuleShell module="Refunds" id="refunds" who={who} scopeNote="Your team's space"
      links={requests}
      contentClass="refund-content" scrollKey={query.toString()}>
      {children}
    </ModuleShell>
  );
}
