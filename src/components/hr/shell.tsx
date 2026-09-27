'use client';

import type { ReactNode } from 'react';
import { History, UserRound, Users } from 'lucide-react';
import { ModuleShell } from '@/components/workspace/module-shell';
import type { HrActor } from '@/lib/hr/access';

/** HR's navigation. */
export function HrShell({ who, initialCollapsed = false, children }: { who: HrActor; initialCollapsed?: boolean; children: ReactNode }) {
  const links = [
    { href: '/hr', label: 'People', icon: Users, isActive: (p: string) => p === '/hr' || p.startsWith('/hr/people/') || p.startsWith('/hr/reviews/') },
    ...(who.superadmin ? [{ href: '/hr/activity', label: 'Who read what', icon: History }] : []),
  ];
  return (
    <ModuleShell module="HR" home="/hr" who={who} links={links} initialCollapsed={initialCollapsed}
      yours={{ href: '/me/hr', label: 'Shared with me', icon: UserRound }}>
      {children}
    </ModuleShell>
  );
}
