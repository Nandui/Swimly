'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { ModuleShell } from '@/components/ui/module-shell';
import { riskPages } from '@/modules/risk/features/workspace/pages';

/** The pages of Risk assessments in the shared workspace frame, from its one page list. */
export function RiskShell({ who, children }: { who: { id: string; name: string; write: boolean }; children: ReactNode }) {
  const pathname = usePathname();
  const links = riskPages(who).map(({ href, label, icon, place, match }) => ({ href, label, icon, place, active: match(pathname) }));
  return (
    <ModuleShell module="Risk assessments" id="risk" who={who} links={links} scopeNote="Your sites">
      {children}
    </ModuleShell>
  );
}
