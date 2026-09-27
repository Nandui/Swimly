'use client';

import type { ReactNode } from 'react';
import { BookOpen, ClipboardCheck, Hourglass, LayoutList, UserRound } from 'lucide-react';
import { ModuleShell } from '@/components/workspace/module-shell';
import type { TrainingActor } from '@/lib/training/access';

/** Training's navigation. Each link appears only for the job the person has;
 *  the pages enforce it again and scope records. */
export function TrainingShell({ who, initialCollapsed = false, children }: {
  who: TrainingActor; initialCollapsed?: boolean; children: ReactNode;
}) {
  const links = [
    { href: '/training', label: 'Overview', icon: LayoutList, isActive: (p: string) => p === '/training' || p.startsWith('/training/people/') },
    ...(who.signoff ? [{ href: '/training/sign-off', label: 'Sign-off', icon: ClipboardCheck }] : []),
    { href: '/training/expiring', label: 'Expiring qualifications', icon: Hourglass },
    { href: '/training/courses', label: 'Courses', icon: BookOpen },
  ];
  return (
    <ModuleShell module="Training" home="/training" who={who} links={links} initialCollapsed={initialCollapsed}
      yours={{ href: '/me/training', label: 'My training', icon: UserRound }}>
      {children}
    </ModuleShell>
  );
}
