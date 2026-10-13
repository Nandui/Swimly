'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { ModuleShell } from '@/components/ui/module-shell';
import { shortCoursesPages } from '@/modules/short-courses/features/workspace/pages';
import type { ShortCoursesActor } from '@/modules/short-courses/shared/access';

/** Short courses' pages in the shared workspace frame, from its one page list. */
export function ShortCoursesShell({ who, children }: { who: ShortCoursesActor; children: ReactNode }) {
  const pathname = usePathname();
  const links = shortCoursesPages().map(({ href, label, icon, match }) => ({ href, label, icon, active: match(pathname) }));
  return (
    <ModuleShell module="Short courses" id="short-courses" who={who} links={links} scopeNote="Only the sites you cover">
      {children}
    </ModuleShell>
  );
}
