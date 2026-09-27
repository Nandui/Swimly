'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { signOut } from 'next-auth/react';
import { ArrowLeft, BookOpen, Building2, ClipboardCheck, Hourglass, LayoutList, LogOut, Menu, PanelLeftClose, PanelLeftOpen, ShieldCheck, UserRound } from 'lucide-react';
import { Sidebar, SidebarProvider, SidebarMenuButton } from '@/components/shadcn/sidebar';
import { Button } from '@/components/shadcn/button';
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from '@/components/shadcn/breadcrumb';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/docs/primitives/sheet';
import { Brand } from '@/components/docs/brand';
import { AppearanceMenu } from '@/components/docs/appearance-menu';
import { Avatar } from '@/components/docs/ui';
import { Notice } from '@/components/ui-kit/notice';
import type { TrainingActor } from '@/lib/training/access';

/** The Poolside Clear workspace shell (as Refunds), with Training's own
 *  navigation. Each link appears only for the job the person has; the pages
 *  enforce it again and scope every record. */
export function TrainingShell({ who, initialCollapsed = false, children }: {
  who: TrainingActor; initialCollapsed?: boolean; children: ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed), [mobile, setMobile] = useState(false);
  const [leaving, setLeaving] = useState(false), [error, setError] = useState('');
  const page = useRef<HTMLElement>(null);
  useEffect(() => { page.current?.scrollTo({ top: 0 }); }, [pathname]);
  function changeCollapsed(value: boolean) {
    setCollapsed(value);
    document.cookie = `turnfin.training.sidebar=${value ? 'collapsed' : 'expanded'}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }
  const links = [
    { href: '/training', label: 'Overview', icon: LayoutList, active: pathname === '/training' },
    ...(who.signoff ? [{ href: '/training/sign-off', label: 'Sign-off', icon: ClipboardCheck, active: pathname === '/training/sign-off' }] : []),
    { href: '/training/expiring', label: 'Expiring qualifications', icon: Hourglass, active: pathname === '/training/expiring' },
    { href: '/training/courses', label: 'Courses', icon: BookOpen, active: pathname.startsWith('/training/courses') },
  ];
  const pageLabel = links.find((link) => link.active)?.label ?? (pathname.startsWith('/training/people/') ? 'Training record' : 'Overview');
  function navigation(inSheet: boolean) {
    const compact = collapsed && !inSheet;
    const item = (entry: typeof links[number]) => <SidebarMenuButton key={entry.label} asChild><Link href={entry.href} className="workspace-nav-item" aria-label={entry.label} title={compact ? entry.label : undefined} aria-current={entry.active ? 'page' : undefined} onClick={() => setMobile(false)}><entry.icon size={18} aria-hidden="true" data-motion="sidebar-icon" /><span>{entry.label}</span></Link></SidebarMenuButton>;
    return <>
      <div className="workspace-sidebar-header">
        <div className="workspace-brand-row"><Link href="/training" aria-label="Turnfin Training overview" onClick={() => setMobile(false)}><Brand module="Training" /></Link>{!inSheet && <Button variant="ghost" size="icon" aria-label={compact ? 'Expand navigation' : 'Collapse navigation'} aria-expanded={!compact} onClick={() => changeCollapsed(!collapsed)}>{compact ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</Button>}</div>
        {!compact && <div className="workspace-organisation"><Building2 size={18} aria-hidden="true" /><div><strong>LeisureWorld</strong><span>Your people · Training</span></div></div>}
      </div>
      <nav className="workspace-navigation" aria-label={inSheet ? 'Mobile Training navigation' : 'Training navigation'}><p className="workspace-nav-label">Workspace</p>{links.map(item)}<p className="workspace-nav-label">Yours</p>{item({ href: '/me/training', label: 'My training', icon: UserRound, active: false })}</nav>
      <div className="workspace-sidebar-footer">
        <Button asChild variant="ghost"><Link href="/modules?view=all" aria-label="All modules"><ArrowLeft size={16} aria-hidden="true" />{!compact && 'All modules'}</Link></Button>
        <AppearanceMenu expanded={!compact} />
        {error && <Notice tone="error" title={error} />}
        <div className="workspace-profile">{!compact && <><Avatar member={who} /><div><strong>{who.name}</strong><span>Staff workspace</span></div></>}<Button variant="ghost" size="icon" aria-label="Sign out" title="Sign out" disabled={leaving} onClick={async () => { setLeaving(true); setError(''); try { await signOut({ redirectTo: '/sign-in' }); } catch { setLeaving(false); setError('Could not sign out. Please try again.'); } }}><LogOut size={17} /></Button></div>
      </div>
    </>;
  }
  return <div className="turnfin-docs turnfin-training"><SidebarProvider open={!collapsed} onOpenChange={open => changeCollapsed(!open)} className="app-shell turnfin-workspace" data-collapsed={collapsed}>
    <a className="skip-link" href="#training-main">Skip to content</a>
    <Sidebar collapsible="none" className="workspace-sidebar" data-collapsed={collapsed}>{navigation(false)}</Sidebar>
    <div className="workspace-surface">
      <header className="workspace-topbar"><Breadcrumb className="workspace-breadcrumb"><BreadcrumbList><BreadcrumbItem><BreadcrumbLink asChild><Link href="/training">Training</Link></BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage>{pageLabel}</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb><span className="workspace-private"><ShieldCheck size={15} aria-hidden="true" />Only the people you cover</span></header>
      <header className="workspace-mobile-toolbar">
        <Sheet open={mobile} onOpenChange={setMobile}><SheetTrigger asChild><Button variant="ghost" size="icon" aria-label="Open navigation"><Menu size={20} /></Button></SheetTrigger><SheetContent side="left" className="workspace-mobile-sheet turnfin-training" aria-describedby="training-nav-description"><SheetTitle className="sr-only">Training navigation</SheetTitle><SheetDescription className="sr-only" id="training-nav-description">Training overview, sign-off, expiring qualifications and courses.</SheetDescription>{navigation(true)}</SheetContent></Sheet>
        <Link href="/training" aria-label="Turnfin Training overview"><Brand module="Training" /></Link><AppearanceMenu />
      </header>
      <main id="training-main" ref={page} tabIndex={-1} className="workspace-page"><div className="page-content workspace-page-content"><div className="training-content">{children}</div><footer className="app-footer"><span>Turnfin Training</span><span className="brand-values">People. Places. Progress.</span></footer></div></main>
    </div>
  </SidebarProvider></div>;
}
