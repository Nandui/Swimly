'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { ModuleShell } from '@/components/workspace/module-shell';
import { rotaPages } from '@/components/rota/pages';
import type { RotaActor } from '@/lib/rota/access';

/** Rota's navigation in the shared workspace shell, from the one list of its pages. */
export function RotaShell({ who, children }: { who: RotaActor; children: ReactNode }) {
  const pathname = usePathname();
  const links = rotaPages(who.manage).map(({ href, label, icon, match }) => ({ href, label, icon, active: match(pathname) }));
  return (
    <ModuleShell module="Rota" id="rota" who={who} links={links} scopeNote="Only the sites you cover">
      {children}
    </ModuleShell>
  );
}
