'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChartNoAxesCombined, ClipboardCheck, Home, Library, Search, Settings } from 'lucide-react';
import { canManage, type Workspace } from '@/lib/docs/types';
import { Button } from '@/components/shadcn/button';
import { ModuleShell } from '@/components/workspace/module-shell';

/** Docs in the shared module frame (DESIGN.md, "Poolside Clear v2"): its pages along the top,
 *  a search shortcut to the library in the tools, and the person's modules down the side. */
export function Shell({
  workspace: w,
  initialCollapsed = false,
  children,
}: {
  workspace: Pick<Workspace, 'member' | 'localMode' | 'canReport'> & { outstandingReading: number };
  initialCollapsed?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const links = [
    { href: '/docs', label: 'Overview', icon: Home, active: pathname === '/docs' },
    { href: '/docs/library', label: 'Document library', icon: Library, active: pathname.startsWith('/docs/library') || pathname.startsWith('/docs/documents') },
    { href: '/docs/work', label: 'My work', icon: ClipboardCheck, active: pathname.startsWith('/docs/work') },
    ...((w.canReport ?? canManage(w.member)) ? [{ href: '/docs/reports', label: 'Reading reports', icon: ChartNoAxesCombined, active: pathname.startsWith('/docs/reports') }] : []),
    ...(canManage(w.member) ? [{ href: '/docs/admin', label: 'Administration', icon: Settings, active: pathname.startsWith('/docs/admin') }] : []),
  ];
  return (
    <ModuleShell module="Docs" id="docs" base="/docs" who={{ id: w.member.id, name: w.member.name }} links={links}
      initialCollapsed={initialCollapsed} scopeNote={w.localMode ? 'Local workspace' : 'Approved guidance for your facility'}
      contentClass="page-content workspace-page-content"
      tools={<Button asChild variant="ghost" size="icon" className="tf-bar-item tf-icon"><Link href="/docs/library" aria-label="Search documents" title="Search documents"><Search aria-hidden="true" /></Link></Button>}>
      {children}
    </ModuleShell>
  );
}
