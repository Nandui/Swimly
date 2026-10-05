'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { BookOpen, ClipboardCheck, FileBadge, Hourglass, LayoutList } from 'lucide-react';
import { ModuleShell } from '@/components/workspace/module-shell';
import type { TrainingActor } from '@/lib/training/access';

/** Training's navigation in the shared workspace shell. Each link appears only
 *  for the job the person has; the pages enforce it again and scope records. */
export function TrainingShell({ who, children }: {
  who: TrainingActor; children: ReactNode;
}) {
  const pathname = usePathname();
  const links = [
    { href: '/training', label: 'Overview', icon: LayoutList, active: pathname === '/training' || pathname.startsWith('/training/people/') },
    ...(who.signoff ? [{ href: '/training/sign-off', label: 'Sign-off', icon: ClipboardCheck, active: pathname === '/training/sign-off' }] : []),
    { href: '/training/expiring', label: 'Expiring qualifications', icon: Hourglass, active: pathname === '/training/expiring' },
    ...(who.qualifications ? [{ href: '/training/certificates', label: 'Certificates to check', icon: FileBadge, active: pathname.startsWith('/training/certificates') }] : []),
    { href: '/training/courses', label: 'Courses', icon: BookOpen, active: pathname.startsWith('/training/courses') },
  ];
  return (
    <ModuleShell module="Training" id="training" who={who} links={links} scopeNote="Only the people you cover">
      {children}
    </ModuleShell>
  );
}
