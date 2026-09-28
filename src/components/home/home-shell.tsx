'use client';

import type { ReactNode } from 'react';
import { House } from 'lucide-react';
import { ModuleShell } from '@/components/workspace/module-shell';
import { allModules } from '@/modules/registry';

/** The home page's frame: the role's home, then its modules down the side.
 *  The modules come from the registry, so the menu is exactly what the role
 *  has; every module page enforces its own access again. */
export function HomeShell({ homeName, moduleIds, who, initialCollapsed = false, children }: {
  homeName: string;
  moduleIds: readonly string[];
  who: { id: string; name: string };
  initialCollapsed?: boolean;
  children: ReactNode;
}) {
  const modules = allModules().filter((m) => moduleIds.includes(m.id));
  const links = [
    { href: '/', label: homeName, icon: House, active: true },
    ...modules.map((m) => ({ href: m.href, label: m.name, icon: m.icon, active: false })),
  ];
  return (
    <ModuleShell module="Home" id="home" base="/" home={false} who={who} links={links} pageLabel="Today" initialCollapsed={initialCollapsed} scopeNote="Only what your role can open">
      {children}
    </ModuleShell>
  );
}
