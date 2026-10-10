'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/** What the frame (ModuleShell, AccountMenu) shows about the signed-in person, handed in by
 *  the app rather than read by the UI kit itself: their modules in order with the group
 *  headings, their role and working site, how to sign out, and any extra top-bar tools (the
 *  development role preview). The root layout provides it (`YourModulesProvider` in
 *  src/components/workspace/your-modules.tsx), so no module shell passes it. Empty when signed
 *  out or outside the layout. */
export type FrameModule = { id: string; name: string; href: string; icon: LucideIcon; group: string };
export type FrameGroup = { key: string; label: string };
export type FrameSetup = {
  modules: readonly FrameModule[];
  groups: readonly FrameGroup[];
  role: string;
  site: string;
  /** Signs the person out; rejects when it could not (the provider has told them why). */
  signOut: () => Promise<void>;
  /** Top-bar controls the app adds to every frame, before the account menu. */
  tools?: ReactNode;
};

const FrameContext = createContext<FrameSetup>({ modules: [], groups: [], role: '', site: '', signOut: async () => {} });

export function FrameProvider({ value, children }: { value: FrameSetup; children: ReactNode }) {
  return <FrameContext.Provider value={value}>{children}</FrameContext.Provider>;
}

export function useFrame(): FrameSetup {
  return useContext(FrameContext);
}

/** Modules under their group headings, in the groups' order; empty groups are left out. */
export function groupFrameModules<M extends FrameModule>(modules: readonly M[], groups: readonly FrameGroup[]): { key: string; label: string; modules: M[] }[] {
  return groups.map((g) => ({ ...g, modules: modules.filter((m) => m.group === g.key) })).filter((g) => g.modules.length > 0);
}
