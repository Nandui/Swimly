'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { ModuleShell } from '@/components/ui/module-shell';
import { paymentsPages } from '@/modules/payments/features/workspace/pages';

/** Payments in the shared module frame: its pages along the top, from its one page list. A
 *  failure's page and every list view sit under Failed payments. */
export function PaymentsShell({ who, children }: { who: { id: string; name: string; manage: boolean }; children: ReactNode }) {
  const pathname = usePathname(), query = useSearchParams();
  const view = pathname === '/payments/overview' ? 'overview' : pathname === '/payments/upload' ? 'upload' : 'failures';
  const links = paymentsPages(who).map(({ href, label, icon, view: page }) => ({ href, label, icon, active: page === view }));
  return (
    <ModuleShell module="Payments" id="payments" who={who} scopeNote="Your sites" links={links} scrollKey={query.toString()}>
      {children}
    </ModuleShell>
  );
}
