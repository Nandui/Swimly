'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { ModuleShell } from '@/components/ui/module-shell';
import { trainingPages } from '@/modules/training/features/workspace/pages';
import type { TrainingActor } from '@/modules/training/shared/access';

/** Training's navigation in the shared workspace shell, from its one page list. */
export function TrainingShell({ who, children }: {
  who: TrainingActor; children: ReactNode;
}) {
  const pathname = usePathname();
  const links = trainingPages(who).map(({ href, label, icon, match }) => ({ href, label, icon, active: match(pathname) }));
  return (
    <ModuleShell module="Training" id="training" who={who} links={links} scopeNote="Only the people you cover">
      {children}
    </ModuleShell>
  );
}
