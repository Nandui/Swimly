'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { ModuleShell } from '@/components/ui/module-shell';
import { academyPages } from '@/modules/academy/features/workspace/pages';
import type { AcademyActor } from '@/modules/academy/shared/access';

/** The Academy's pages in the shared workspace frame, from its one page list. */
export function AcademyShell({ who, children }: { who: AcademyActor; children: ReactNode }) {
  const pathname = usePathname();
  const links = academyPages().map(({ href, label, icon, match }) => ({ href, label, icon, active: match(pathname) }));
  return (
    <ModuleShell module="Academy" id="academy" who={who} links={links} scopeNote="Only the sites you cover">
      {children}
    </ModuleShell>
  );
}
