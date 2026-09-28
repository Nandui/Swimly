'use client';

import type { ReactNode } from 'react';
import { ModuleShell } from '@/components/workspace/module-shell';

/** The home page in the shared frame: "Your modules" down the side, exactly
 *  what the role has; every module page enforces its own access again. */
export function HomeShell({ homeName, who, initialCollapsed = false, children }: {
  homeName: string;
  who: { id: string; name: string };
  initialCollapsed?: boolean;
  children: ReactNode;
}) {
  return (
    <ModuleShell module={homeName} id="home" current="home" base="/" who={who} pageLabel="Today" initialCollapsed={initialCollapsed} scopeNote="Only what your role can open">
      {children}
    </ModuleShell>
  );
}
