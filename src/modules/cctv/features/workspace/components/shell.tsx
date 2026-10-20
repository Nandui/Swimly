'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { ModuleShell } from '@/components/ui/module-shell';
import { cctvPages } from '@/modules/cctv/features/workspace/pages';
import type { CctvActor } from '@/modules/cctv/shared/access';

/** The CCTV log's pages in the shared workspace frame, from its one page list. */
export function CctvShell({ who, children }: { who: CctvActor; children: ReactNode }) {
  const pathname = usePathname();
  const links = cctvPages().map(({ href, label, icon, match }) => ({ href, label, icon, active: match(pathname) }));
  return (
    <ModuleShell module="CCTV log" id="cctv" who={who} links={links} scopeNote={who.review ? "Only the sites you cover" : "Only the viewings you recorded"}>
      {children}
    </ModuleShell>
  );
}
