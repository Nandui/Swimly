'use client';

import { type ReactNode } from 'react';
import { signOut } from 'next-auth/react';
import { RolePreviewToggle } from '@/components/staff/role-preview';
import { FrameProvider } from '@/components/ui/frame';
import { toast } from '@/lib/toast';
import { allModules, MODULE_GROUPS } from '@/modules/registry';

/** The signed-in person's modules, role and working site, set once by the
 *  root layout from their session (docs/how-turnfin-works.md), so every frame
 *  offers the same modules and the account menu names the same role and site
 *  without a shell passing them. It fills the UI kit's frame context
 *  (src/components/ui/frame.tsx) with them, with signing out and the role
 *  preview, so the frame itself never reads the registry or the session. */
export function YourModulesProvider({ ids, role, site, children }: { ids: readonly string[]; role: string; site: string; children: ReactNode }) {
  const modules = allModules().filter((m) => ids.includes(m.id)).map(({ id, name, href, icon, group }) => ({ id, name, href, icon, group }));
  async function leave() {
    try { await signOut({ redirectTo: '/sign-in' }); }
    catch (error) { toast.error('Could not sign out. Try again.'); throw error; }
  }
  return (
    <FrameProvider value={{ modules, groups: MODULE_GROUPS, role, site, signOut: leave, tools: <RolePreviewToggle /> }}>
      {children}
    </FrameProvider>
  );
}
