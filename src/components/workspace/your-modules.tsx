'use client';

import Link from 'next/link';
import { createContext, useContext, type ReactNode } from 'react';
import { House } from 'lucide-react';
import { SidebarMenuButton } from '@/components/shadcn/sidebar';
import { allModules, type ModuleManifest } from '@/modules/registry';

/** The signed-in person's modules, set once by the root layout from their
 *  role (docs/how-turnfin-works.md), so every frame shows the same menu. */
const YourModules = createContext<readonly string[]>([]);

export function YourModulesProvider({ ids, children }: { ids: readonly string[]; children: ReactNode }) {
  return <YourModules.Provider value={ids}>{children}</YourModules.Provider>;
}

export function useYourModules(): ModuleManifest[] {
  const ids = useContext(YourModules);
  return allModules().filter((m) => ids.includes(m.id));
}

/** Home, then each of the person's modules: the one way to move between
 *  modules, in every frame. \`current\` marks the module being shown. */
export function YourModulesNav({ current, compact = false, onNavigate }: { current?: string; compact?: boolean; onNavigate?: () => void }) {
  const modules = useYourModules();
  const item = (key: string, href: string, label: string, Icon: typeof House, active: boolean) => (
    <SidebarMenuButton key={key} asChild>
      <Link href={href} className="workspace-nav-item" aria-label={label} title={compact ? label : undefined} aria-current={active ? 'page' : undefined} onClick={onNavigate}>
        <Icon size={18} aria-hidden="true" data-motion="sidebar-icon" /><span>{label}</span>
      </Link>
    </SidebarMenuButton>
  );
  return (
    <>
      <p className="workspace-nav-label">Your modules</p>
      {item('home', '/', 'Home', House, current === 'home')}
      {modules.map((m) => item(m.id, m.href, m.name, m.icon, m.id === current))}
    </>
  );
}
