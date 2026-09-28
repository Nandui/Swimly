'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { CheckCheck, CircleHelp, Clock3, FilePenLine, Inbox, ReceiptText, UserRound } from 'lucide-react';
import { ModuleShell } from '@/components/workspace/module-shell';
import type { RefundActor } from '@/lib/refunds/types';

/** Refunds in the shared module frame: its requests and follow-up queues. */
export function RefundShell({ who, initialCollapsed = false, children }: {
  who: RefundActor; initialCollapsed?: boolean; children: ReactNode;
}) {
  const pathname = usePathname(), query = useSearchParams();
  const onList = pathname === '/refunds';
  const selectedStatus = query.get('status');
  const myRequests = query.get('creator') === who.id;
  const quickStatus = (status: string) => onList && !myRequests && selectedStatus === status;
  const requests = [
    { href: '/refunds', label: 'Refund requests', icon: ReceiptText, active: onList && !myRequests && (!selectedStatus || ['all', 'open', 'actionable', 'IN_REVIEW', 'DECLINED', 'WITHDRAWN'].includes(selectedStatus)) },
    { href: `/refunds?creator=${encodeURIComponent(who.id)}&status=all`, label: 'My requests', icon: UserRound, active: onList && myRequests && selectedStatus !== 'DRAFT' },
    ...(who.request ? [{ href: '/refunds?status=DRAFT', label: 'My drafts', icon: FilePenLine, active: onList && selectedStatus === 'DRAFT' }] : []),
  ];
  const followUp = [
    ...(who.review ? [{ href: '/refunds?status=SUBMITTED', label: 'Submitted', icon: Inbox, active: quickStatus('SUBMITTED') }] : []),
    ...(who.request ? [{ href: '/refunds?status=NEEDS_INFORMATION', label: 'Needs information', icon: CircleHelp, active: quickStatus('NEEDS_INFORMATION') }] : []),
    { href: '/refunds?status=APPROVED', label: 'Awaiting payment', icon: Clock3, active: quickStatus('APPROVED') },
    { href: '/refunds?status=REFUNDED', label: 'Refunded', icon: CheckCheck, active: quickStatus('REFUNDED') },
  ];
  const pageLabel = pathname === '/refunds/new' ? 'New request' : onList ? 'Requests' : 'Request details';
  return (
    <ModuleShell module="Refunds" id="refunds" who={who} pageLabel={pageLabel} initialCollapsed={initialCollapsed} scopeNote="Your team's space"
      groups={[{ label: 'Requests', links: requests }, { label: 'Follow up', links: followUp }]}
      contentClass="refund-content" scrollKey={query.toString()}>
      {children}
    </ModuleShell>
  );
}
