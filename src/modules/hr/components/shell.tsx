'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { ClipboardList, History, Users } from 'lucide-react';
import { ModuleShell } from '@/components/workspace/module-shell';
import type { HrActor } from '@/modules/hr/lib/access';

/** HR's navigation in the shared workspace shell. */
export function HrShell({ who, children }: { who: HrActor; children: ReactNode }) {
  const pathname = usePathname();
  const links = [
    { href: '/hr', label: 'People', icon: Users, active: pathname === '/hr' || pathname.startsWith('/hr/people') || pathname.startsWith('/hr/reviews') },
    ...(who.details ? [{ href: '/hr/details-requests', label: 'Details changes', icon: ClipboardList, active: pathname === '/hr/details-requests' }] : []),
    ...(who.superadmin ? [{ href: '/hr/activity', label: 'Who read what', icon: History, active: pathname === '/hr/activity' }] : []),
  ];
  return (
    <ModuleShell module="HR" id="hr" who={who} links={links} scopeNote="Restricted · every read is logged">
      {children}
    </ModuleShell>
  );
}
