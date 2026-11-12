'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { ModuleShell } from '@/components/ui/module-shell';
import { voucherPages } from '@/modules/vouchers/features/workspace/pages';
import type { VouchersActor } from '@/modules/vouchers/shared/access';

/** The Vouchers pages in the shared workspace frame, from its one page list. */
export function VouchersShell({ who, children }: { who: VouchersActor; children: ReactNode }) {
  const pathname = usePathname();
  const links = voucherPages(who).map(({ href, label, icon, place, match }) => ({ href, label, icon, place, active: match(pathname) }));
  return (
    <ModuleShell module="Vouchers" id="vouchers" who={who} links={links} scopeNote="Only the sites you cover">
      {children}
    </ModuleShell>
  );
}
