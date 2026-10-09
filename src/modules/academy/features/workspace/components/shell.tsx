'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { CalendarRange, ListChecks, Phone } from 'lucide-react';
import { ModuleShell } from '@/components/workspace/module-shell';
import type { AcademyActor } from '@/modules/academy/lib/access';

/** The Academy's pages in the shared workspace frame. */
export function AcademyShell({ who, children }: { who: AcademyActor; children: ReactNode }) {
  const pathname = usePathname();
  const links = [
    { href: '/academy', label: 'Courses', icon: CalendarRange, active: pathname === '/academy' || /^\/academy\/(?!types|calls)/.test(pathname) },
    { href: '/academy/calls', label: 'To call', icon: Phone, active: pathname.startsWith('/academy/calls') },
    { href: '/academy/types', label: 'Course list', icon: ListChecks, active: pathname.startsWith('/academy/types') },
  ];
  return (
    <ModuleShell module="Academy" id="academy" who={who} links={links} scopeNote="Only the sites you cover">
      {children}
    </ModuleShell>
  );
}
