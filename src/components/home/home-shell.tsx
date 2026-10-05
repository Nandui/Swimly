'use client';

import type { ReactNode } from 'react';
import { ModuleShell } from '@/components/workspace/module-shell';

/** The home page in the shared frame: "Your modules" down the side, exactly
 *  what the role has; every module page enforces its own access again. */
export function HomeShell({ who, children }: {
  who: { id: string; name: string };
  children: ReactNode;
}) {
  return (
    <ModuleShell module="Home" id="home" current="home" who={who} scopeNote="Only what your role can open">
      {children}
    </ModuleShell>
  );
}
