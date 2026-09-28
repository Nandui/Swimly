'use client';

import Link from 'next/link';
import { createContext, useContext, type ReactNode } from 'react';
import { House } from 'lucide-react';
import { Button } from '@/components/shadcn/button';
import { SidebarMenuButton } from '@/components/shadcn/sidebar';
import { cn } from '@/lib/utils';
import { allModules, type ModuleManifest } from '@/modules/registry';

/** The signed-in person's modules, set once by the root layout from their
 *  role (docs/how-turnfin-works.md), so every frame offers the same ones. */
const YourModules = createContext<readonly string[]>([]);

export function YourModulesProvider({ ids, children }: { ids: readonly string[]; children: ReactNode }) {
  return <YourModules.Provider value={ids}>{children}</YourModules.Provider>;
}

export function useYourModules(): ModuleManifest[] {
  const ids = useContext(YourModules);
  return allModules().filter((m) => ids.includes(m.id));
}

/** The home page's menu: each of the person's modules. Inside a module the
 *  sidebar shows only that module's pages, under `HomeButton`. */
export function YourModulesNav({ compact = false, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
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
      {item('home', '/', 'Home', House, true)}
      <p className="workspace-nav-label">Your modules</p>
      {modules.map((m) => item(m.id, m.href, m.name, m.icon, false))}
    </>
  );
}

/** Inside a module, the way back to the person's modules: one button to
 *  the home page, where they are listed. */
export function HomeButton({ compact = false, onNavigate, className }: { compact?: boolean; onNavigate?: () => void; className?: string }) {
  return (
    <Button asChild variant="outline" size={compact ? 'icon' : 'default'} className={cn('home-button h-11 min-w-0', compact ? 'size-11' : 'w-full justify-start', className)}>
      <Link href="/" onClick={onNavigate} aria-label="Home" title={compact ? 'Home' : undefined}><House aria-hidden="true" />{!compact && <span>Home</span>}</Link>
    </Button>
  );
}
