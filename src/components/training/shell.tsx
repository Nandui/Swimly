'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { BookOpen, ClipboardCheck, FileBadge, Hourglass, LayoutList } from 'lucide-react';
import { ModuleShell } from '@/components/workspace/module-shell';
import type { TrainingActor } from '@/lib/training/access';

/** Training's navigation in the shared workspace shell. Each link appears only
 *  for the job the person has; the pages enforce it again and scope records. */
export function TrainingShell({ who, initialCollapsed = false, children }: {
  who: TrainingActor; initialCollapsed?: boolean; children: ReactNode;
}) {
  const pathname = usePathname();
  const links = [
    { href: '/training', label: 'Overview', icon: LayoutList, active: pathname === '/training' },
    ...(who.signoff ? [{ href: '/training/sign-off', label: 'Sign-off', icon: ClipboardCheck, active: pathname === '/training/sign-off' }] : []),
    { href: '/training/expiring', label: 'Expiring qualifications', icon: Hourglass, active: pathname === '/training/expiring' },
    ...(who.qualifications ? [{ href: '/training/certificates', label: 'Certificates to check', icon: FileBadge, active: pathname.startsWith('/training/certificates') }] : []),
    { href: '/training/courses', label: 'Courses', icon: BookOpen, active: pathname.startsWith('/training/courses') },
  ];
  const pageLabel = links.find((link) => link.active)?.label ?? (pathname.startsWith('/training/people/') ? 'Training record' : 'Overview');
  return (
    <ModuleShell module="Training" id="training" who={who} links={links} pageLabel={pageLabel} initialCollapsed={initialCollapsed} scopeNote="Only the people you cover">
      {children}
    </ModuleShell>
  );
}
