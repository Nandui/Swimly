'use client';

import type { ReactNode } from 'react';
import { ModuleShell } from '@/components/workspace/module-shell';

/** The home page in the shared frame: "Your modules" down the side, exactly
 *  what the role has; every module page enforces its own access again. */
export function HomeShell({ who, initialCollapsed = false, children }: {
  who: { id: string; name: string };
  initialCollapsed?: boolean;
  children: ReactNode;
}) {
  return (
    <ModuleShell module="Hub" id="home" current="home" base="/" who={who} pageLabel="Today" initialCollapsed={initialCollapsed} scopeNote="Only what your role can open">
      {children}
    </ModuleShell>
  );
}
