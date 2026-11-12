'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Gift, Ticket } from 'lucide-react';
import { ModuleShell } from '@/components/workspace/module-shell';
import type { VouchersActor } from '@/lib/vouchers/access';

/** The Vouchers pages in the shared workspace frame: Redeem for the desk, and
 *  Issued for whoever gives vouchers out. */
export function VouchersShell({ who, children }: { who: VouchersActor; children: ReactNode }) {
  const pathname = usePathname();
  const links = [
    { href: '/vouchers', label: 'Redeem', icon: Ticket, active: pathname === '/vouchers' },
    ...(who.manage ? [{ href: '/vouchers/batches', label: 'Issued', icon: Gift, active: pathname.startsWith('/vouchers/batches') }] : []),
  ];
  return (
    <ModuleShell module="Vouchers" id="vouchers" who={who} links={links} scopeNote="Only the sites you cover">
      {children}
    </ModuleShell>
  );
}
