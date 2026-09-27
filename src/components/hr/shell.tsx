'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { History, Users } from 'lucide-react';
import { ModuleShell } from '@/components/workspace/module-shell';
import type { HrActor } from '@/lib/hr/access';

/** HR's navigation in the shared workspace shell. */
export function HrShell({ who, initialCollapsed = false, children }: { who: HrActor; initialCollapsed?: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const links = [
    { href: '/hr', label: 'People', icon: Users, active: pathname === '/hr' || pathname.startsWith('/hr/people') || pathname.startsWith('/hr/reviews') },
    ...(who.superadmin ? [{ href: '/hr/activity', label: 'Who read what', icon: History, active: pathname === '/hr/activity' }] : []),
  ];
  const pageLabel = pathname.startsWith('/hr/reviews') ? 'Review' : pathname.startsWith('/hr/people') ? 'HR record' : links.find((l) => l.active)?.label ?? 'People';
  return (
    <ModuleShell module="HR" id="hr" who={who} links={links} pageLabel={pageLabel} initialCollapsed={initialCollapsed} scopeNote="Restricted · every read is logged">
      {children}
    </ModuleShell>
  );
}
