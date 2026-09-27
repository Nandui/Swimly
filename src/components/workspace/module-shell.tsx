'use client';

import type { ReactNode } from 'react';
import { signOut } from 'next-auth/react';
import type { LucideIcon } from 'lucide-react';
import { AppShell } from '@/components/ui-kit/app-shell';
import { ThemeFlip } from '@/components/theme-toggle';

export type ModuleLink = { href: string; label: string; icon: LucideIcon; isActive?: (pathname: string) => boolean };

/** The shell for Turnfin's people-scoped modules (Training, HR, Rota): the
 *  app's own Neutral design and `AppShell`, with the module's navigation, the
 *  person's own view under "Yours", and All modules. Poolside Clear belongs to
 *  Docs and Refunds only. Links are presentation; every page enforces access
 *  again and scopes its records. */
export function ModuleShell({ module, home, who, links, yours, initialCollapsed = false, children }: {
  /** Display name, e.g. "Training". */
  module: string;
  home: string;
  who: { name: string };
  links: ModuleLink[];
  /** The person's own view of this module (their My surface). */
  yours?: ModuleLink;
  initialCollapsed?: boolean;
  children: ReactNode;
}) {
  return (
    <AppShell
      wordmark={module}
      homeHref={home}
      portalHref="/modules?view=all"
      groups={[
        { id: 'module', label: module, items: links },
        ...(yours ? [{ id: 'yours', label: 'Yours', items: [yours] }] : []),
      ]}
      userName={who.name}
      userSubtitle={`Turnfin ${module}`}
      initialCollapsed={initialCollapsed}
      contentMaxWidth={1200}
      tools={<ThemeFlip />}
      onSignOut={() => void signOut({ redirectTo: '/sign-in' })}
    >
      {children}
    </AppShell>
  );
}
