'use client';

import Link from 'next/link';
import { createContext, useContext, type ReactNode } from 'react';
import { Check, ChevronsUpDown, House } from 'lucide-react';
import { Button } from '@/components/shadcn/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/shadcn/dropdown-menu';
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
 *  sidebar shows only that module's pages, and `ModuleSwitcher` moves on. */
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

/** The one way to move between modules from inside one: a button naming the
 *  current module that opens Home and the person's other modules. */
export function ModuleSwitcher({ current, compact = false, onNavigate, className }: { current: string; compact?: boolean; onNavigate?: () => void; className?: string }) {
  const modules = useYourModules();
  const here = modules.find((m) => m.id === current) ?? allModules().find((m) => m.id === current);
  const Icon = here?.icon ?? House;
  const name = here?.name ?? 'Home';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={compact ? 'icon' : 'default'} className={cn('module-switcher h-11 min-w-0', compact ? 'size-11' : 'w-full justify-start', className)} aria-label={`${name}. Switch module`} title={compact ? `${name}. Switch module` : undefined}>
          <Icon aria-hidden="true" />{!compact && <><span className="min-w-0 truncate">{name}</span><ChevronsUpDown className="ml-auto" aria-hidden="true" /></>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side={compact ? 'right' : 'bottom'} className="w-64 max-w-[calc(100vw-2rem)]">
        <DropdownMenuItem asChild className="min-h-11"><Link href="/" onClick={onNavigate}><House aria-hidden="true" />Home</Link></DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Your modules</DropdownMenuLabel>
        {modules.map((m) => (
          <DropdownMenuItem key={m.id} asChild className="min-h-11">
            <Link href={m.href} onClick={onNavigate} aria-current={m.id === current ? 'page' : undefined}>
              <m.icon aria-hidden="true" />{m.name}{m.id === current && <Check className="ml-auto" aria-label="Current module" />}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
