'use client';

import Link from 'next/link';
import { createContext, useContext, type ReactNode } from 'react';
import { ArrowLeft, CircleHelp, House } from 'lucide-react';
import { Button } from '@/components/shadcn/button';
import { SidebarMenuButton } from '@/components/shadcn/sidebar';
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

/** Inside a module, the way back to the person's modules: an outline
 *  "Back to Hub" button in the sidebar footer. */
export function HomeButton({ compact = false, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  return (
    <Button asChild variant="outline" size={compact ? 'icon' : 'default'} className={compact ? 'workspace-hub-button' : 'workspace-hub-button w-full justify-start'}>
      <Link href="/" onClick={onNavigate} aria-label="Back to Hub" title={compact ? 'Back to Hub' : undefined}><ArrowLeft aria-hidden="true" />{!compact && <span>Back to Hub</span>}</Link>
    </Button>
  );
}

/** Help, beside the Appearance button in the sidebar footer. */
export function HelpButton({ compact = false }: { compact?: boolean }) {
  return (
    <Button asChild variant="ghost" size={compact ? 'icon' : 'default'} className={compact ? undefined : 'flex-1 justify-start'}>
      <Link href="/help" target="_blank" rel="noopener noreferrer" aria-label="Help (opens in a new tab)" title="Help"><CircleHelp aria-hidden="true" />{!compact && <span>Help</span>}</Link>
    </Button>
  );
}
