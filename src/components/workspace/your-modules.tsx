'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { allModules, type ModuleManifest } from '@/modules/registry';

type YourWork = { ids: readonly string[]; role: string; site: string };

/** The signed-in person's modules, role and working site, set once by the
 *  root layout from their session (docs/how-turnfin-works.md), so every frame
 *  offers the same modules and the account menu names the same role and site
 *  without a shell passing them. Empty when signed out or outside the layout. */
const YourModules = createContext<YourWork>({ ids: [], role: '', site: '' });

export function YourModulesProvider({ ids, role, site, children }: YourWork & { children: ReactNode }) {
  return <YourModules.Provider value={{ ids, role, site }}>{children}</YourModules.Provider>;
}

/** The person's modules in group order (MODULE_GROUPS); `groupModules` adds the headings. */
export function useYourModules(): ModuleManifest[] {
  const { ids } = useContext(YourModules);
  return allModules().filter((m) => ids.includes(m.id));
}

/** The role (the worn one in View as) and working site, for the account menu. */
export function useYourAccount(): { role: string; site: string } {
  const { role, site } = useContext(YourModules);
  return { role, site };
}
