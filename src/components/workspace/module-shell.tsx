'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { signOut } from 'next-auth/react';
import { ArrowLeft, Building2, LogOut, Menu, PanelLeftClose, PanelLeftOpen, ShieldCheck, type LucideIcon } from 'lucide-react';
import { Sidebar, SidebarProvider, SidebarMenuButton } from '@/components/shadcn/sidebar';
import { Button } from '@/components/shadcn/button';
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from '@/components/shadcn/breadcrumb';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/docs/primitives/sheet';
import { Brand } from '@/components/docs/brand';
import { AppearanceMenu } from '@/components/docs/appearance-menu';
import { Avatar } from '@/components/docs/ui';
import { Notice } from '@/components/ui-kit/notice';

export type ModuleLink = { href: string; label: string; icon: LucideIcon; active: boolean };

/** The Poolside Clear workspace shell shared by people-scoped Turnfin modules
 *  (Training, HR, Rota): the Docs shell layout with the module's own sidebar,
 *  mobile sheet, collapse preference and breadcrumb. Links are presentation;
 *  every page enforces access again and scopes its records. */
export function ModuleShell({ module, id, who, links, scopeNote, pageLabel, initialCollapsed = false, children }: {
  /** Display name, e.g. "Training". */
  module: string;
  /** Short id for the scope class, cookie and landmarks, e.g. "training". */
  id: string;
  who: { id: string; name: string };
  links: ModuleLink[];
  scopeNote: string;
  pageLabel: string;
  initialCollapsed?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const base = `/${id}`;
  const [collapsed, setCollapsed] = useState(initialCollapsed), [mobile, setMobile] = useState(false);
  const [leaving, setLeaving] = useState(false), [error, setError] = useState('');
  const page = useRef<HTMLElement>(null);
  useEffect(() => { page.current?.scrollTo({ top: 0 }); }, [pathname]);
  function changeCollapsed(value: boolean) {
    setCollapsed(value);
    document.cookie = `turnfin.${id}.sidebar=${value ? 'collapsed' : 'expanded'}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }
  function navigation(inSheet: boolean) {
    const compact = collapsed && !inSheet;
    const item = (entry: ModuleLink) => <SidebarMenuButton key={entry.label} asChild><Link href={entry.href} className="workspace-nav-item" aria-label={entry.label} title={compact ? entry.label : undefined} aria-current={entry.active ? 'page' : undefined} onClick={() => setMobile(false)}><entry.icon size={18} aria-hidden="true" data-motion="sidebar-icon" /><span>{entry.label}</span></Link></SidebarMenuButton>;
    return <>
      <div className="workspace-sidebar-header">
        <div className="workspace-brand-row"><Link href={base} aria-label={`Turnfin ${module} overview`} onClick={() => setMobile(false)}><Brand module={module} /></Link>{!inSheet && <Button variant="ghost" size="icon" aria-label={compact ? 'Expand navigation' : 'Collapse navigation'} aria-expanded={!compact} onClick={() => changeCollapsed(!collapsed)}>{compact ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</Button>}</div>
        {!compact && <div className="workspace-organisation"><Building2 size={18} aria-hidden="true" /><div><strong>LeisureWorld</strong><span>Your people · {module}</span></div></div>}
      </div>
      <nav className="workspace-navigation" aria-label={inSheet ? `Mobile ${module} navigation` : `${module} navigation`}><p className="workspace-nav-label">Workspace</p>{links.map(item)}</nav>
      <div className="workspace-sidebar-footer">
        <Button asChild variant="ghost"><Link href="/modules?view=all" aria-label="All modules"><ArrowLeft size={16} aria-hidden="true" />{!compact && 'All modules'}</Link></Button>
        <AppearanceMenu expanded={!compact} />
        {error && <Notice tone="error" title={error} />}
        <div className="workspace-profile">{!compact && <><Avatar member={who} /><div><strong>{who.name}</strong><span>Staff workspace</span></div></>}<Button variant="ghost" size="icon" aria-label="Sign out" title="Sign out" disabled={leaving} onClick={async () => { setLeaving(true); setError(''); try { await signOut({ redirectTo: '/sign-in' }); } catch { setLeaving(false); setError('Could not sign out. Please try again.'); } }}><LogOut size={17} /></Button></div>
      </div>
    </>;
  }
  return <div className={`turnfin-docs turnfin-module turnfin-${id}`}><SidebarProvider open={!collapsed} onOpenChange={open => changeCollapsed(!open)} className="app-shell turnfin-workspace" data-collapsed={collapsed}>
    <a className="skip-link" href={`#${id}-main`}>Skip to content</a>
    <Sidebar collapsible="none" className="workspace-sidebar" data-collapsed={collapsed}>{navigation(false)}</Sidebar>
    <div className="workspace-surface">
      <header className="workspace-topbar"><Breadcrumb className="workspace-breadcrumb"><BreadcrumbList><BreadcrumbItem><BreadcrumbLink asChild><Link href={base}>{module}</Link></BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage>{pageLabel}</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb><span className="workspace-private"><ShieldCheck size={15} aria-hidden="true" />{scopeNote}</span></header>
      <header className="workspace-mobile-toolbar">
        <Sheet open={mobile} onOpenChange={setMobile}><SheetTrigger asChild><Button variant="ghost" size="icon" aria-label="Open navigation"><Menu size={20} /></Button></SheetTrigger><SheetContent side="left" className={`workspace-mobile-sheet turnfin-module turnfin-${id}`} aria-describedby={`${id}-nav-description`}><SheetTitle className="sr-only">{module} navigation</SheetTitle><SheetDescription className="sr-only" id={`${id}-nav-description`}>{links.map((l) => l.label).join(', ')}.</SheetDescription>{navigation(true)}</SheetContent></Sheet>
        <Link href={base} aria-label={`Turnfin ${module} overview`}><Brand module={module} /></Link><AppearanceMenu />
      </header>
      <main id={`${id}-main`} ref={page} tabIndex={-1} className="workspace-page"><div className="page-content workspace-page-content"><div className="module-content">{children}</div><footer className="app-footer"><span>Turnfin {module}</span><span className="brand-values">People. Places. Progress.</span></footer></div></main>
    </div>
  </SidebarProvider></div>;
}
