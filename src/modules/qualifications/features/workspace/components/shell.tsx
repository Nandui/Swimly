'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { ModuleShell } from '@/components/ui/module-shell';
import { qualificationsPages } from '@/modules/qualifications/features/workspace/pages';
import type { QualificationsActor } from '@/modules/qualifications/shared/access';

/** Qualifications' pages in the shared workspace frame, from its one page list. */
export function QualificationsShell({ who, children }: { who: QualificationsActor; children: ReactNode }) {
  const pathname = usePathname();
  const links = qualificationsPages().map(({ href, label, icon, place, under, match }) => ({ href, label, icon, place, under, active: match(pathname) }));
  return (
    <ModuleShell module="Qualifications" id="qualifications" who={who} links={links} scopeNote="Only the people you cover">
      {children}
    </ModuleShell>
  );
}
