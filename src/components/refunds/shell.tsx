'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { signOut } from 'next-auth/react';
import { ArrowLeft, Building2, CheckCheck, CircleHelp, Clock3, FilePenLine, Inbox, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Plus, ReceiptText, ShieldCheck, UserRound } from 'lucide-react';
import { Sidebar, SidebarProvider, SidebarMenuButton } from '@/components/shadcn/sidebar';
import { Button } from '@/components/shadcn/button';
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbPage, BreadcrumbSeparator } from '@/components/shadcn/breadcrumb';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/docs/primitives/sheet';
import { Brand } from '@/components/docs/brand';
import { AppearanceMenu } from '@/components/docs/appearance-menu';
import { Avatar } from '@/components/docs/ui';
import { Notice } from '@/components/ui-kit/notice';
import type { RefundActor } from '@/lib/refunds/types';

/** The Docs visual language, with an independent Refunds navigation and access boundary. */
export function RefundShell({ who, initialCollapsed = false, children }: {
  who: RefundActor; initialCollapsed?: boolean; children: ReactNode;
}) {
  const pathname = usePathname(), query = useSearchParams();
  const [collapsed, setCollapsed] = useState(initialCollapsed), [mobile, setMobile] = useState(false);
  const [leaving, setLeaving] = useState(false), [error, setError] = useState('');
  const page = useRef<HTMLElement>(null);
  const queryKey = query.toString();
  useEffect(() => { page.current?.scrollTo({ top: 0 }); }, [pathname, queryKey]);
  const pageLabel = pathname === '/refunds/new' ? 'New request' : pathname === '/refunds' ? 'Requests' : 'Request details';
  function changeCollapsed(value: boolean) {
    setCollapsed(value);
    document.cookie = `turnfin.refunds.sidebar=${value ? 'collapsed' : 'expanded'}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }
  const selectedStatus = query.get('status');
  const myRequests = query.get('creator') === who.id;
  const quickStatus = (status: string) => !myRequests && selectedStatus === status;
  const links = [
    { href: '/refunds', label: 'Refund requests', icon: ReceiptText, active: !myRequests && (!selectedStatus || ['all', 'open', 'actionable', 'IN_REVIEW', 'DECLINED', 'WITHDRAWN'].includes(selectedStatus)) },
    { href: `/refunds?creator=${encodeURIComponent(who.id)}&status=all`, label: 'My requests', icon: UserRound, active: myRequests && selectedStatus !== 'DRAFT' },
    ...(who.request ? [{ href: '/refunds?status=DRAFT', label: 'My drafts', icon: FilePenLine, active: query.get('status') === 'DRAFT' }] : []),
  ];
  const followUp = [
    ...(who.review ? [{ href: '/refunds?status=SUBMITTED', label: 'Submitted', icon: Inbox, active: quickStatus('SUBMITTED') }] : []),
    ...(who.request ? [{ href: '/refunds?status=NEEDS_INFORMATION', label: 'Needs information', icon: CircleHelp, active: quickStatus('NEEDS_INFORMATION') }] : []),
    { href: '/refunds?status=APPROVED', label: 'Awaiting payment', icon: Clock3, active: quickStatus('APPROVED') },
    { href: '/refunds?status=REFUNDED', label: 'Refunded', icon: CheckCheck, active: quickStatus('REFUNDED') },
  ];
  function navigation(inSheet: boolean) {
    const compact = collapsed && !inSheet;
    const item = (entry: typeof links[number]) => <SidebarMenuButton key={entry.label} asChild><Link href={entry.href} className="workspace-nav-item" aria-label={entry.label} title={compact ? entry.label : undefined} aria-current={pathname === '/refunds' && entry.active ? 'page' : undefined} onClick={() => setMobile(false)}><entry.icon size={18} aria-hidden="true" data-motion="sidebar-icon" /><span>{entry.label}</span></Link></SidebarMenuButton>;
    return <>
      <div className="workspace-sidebar-header">
        <div className="workspace-brand-row"><Link href="/refunds" aria-label="Turnfin Refunds overview" onClick={() => setMobile(false)}><Brand module="Refunds" /></Link>{!inSheet && <Button variant="ghost" size="icon" aria-label={compact ? 'Expand navigation' : 'Collapse navigation'} aria-expanded={!compact} onClick={() => changeCollapsed(!collapsed)}>{compact ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</Button>}</div>
        {!compact && <div className="workspace-organisation"><Building2 size={18} aria-hidden="true" /><div><strong>LeisureWorld</strong><span>Both sites · Refunds</span></div></div>}
        {who.request && <Button asChild size={compact ? 'icon' : 'default'} className="workspace-create"><Link href="/refunds/new" aria-label="New request" title={compact ? 'New request' : undefined} onClick={() => setMobile(false)}><Plus size={18} aria-hidden="true" />{!compact && <span>New request</span>}</Link></Button>}
      </div>
      <nav className="workspace-navigation" aria-label={inSheet ? 'Mobile Refunds navigation' : 'Refunds navigation'}><p className="workspace-nav-label">Workspace</p>{links.map(item)}<p className="workspace-nav-label">Follow up</p>{followUp.map(item)}</nav>
      <div className="workspace-sidebar-footer">
        <Button asChild variant="ghost"><Link href="/modules?view=all" aria-label="All modules"><ArrowLeft size={16} aria-hidden="true" />{!compact && 'All modules'}</Link></Button>
        <AppearanceMenu expanded={!compact} />
        {error && <Notice tone="error" title={error} />}
        <div className="workspace-profile">{!compact && <><Avatar member={who} /><div><strong>{who.name}</strong><span>Staff workspace</span></div></>}<Button variant="ghost" size="icon" aria-label="Sign out" title="Sign out" disabled={leaving} onClick={async () => { setLeaving(true); setError(''); try { await signOut({ redirectTo: '/sign-in' }); } catch { setLeaving(false); setError('Could not sign out. Please try again.'); } }}><LogOut size={17} /></Button></div>
      </div>
    </>;
  }
  return <div className="turnfin-docs turnfin-refunds"><SidebarProvider open={!collapsed} onOpenChange={open => changeCollapsed(!open)} className="app-shell turnfin-workspace" data-collapsed={collapsed}>
    <a className="skip-link" href="#refund-main">Skip to content</a>
    <Sidebar collapsible="none" className="workspace-sidebar" data-collapsed={collapsed}>{navigation(false)}</Sidebar>
    <div className="workspace-surface">
      <header className="workspace-topbar"><Breadcrumb className="workspace-breadcrumb"><BreadcrumbList><BreadcrumbItem>LeisureWorld</BreadcrumbItem><BreadcrumbSeparator /><BreadcrumbItem>Refunds</BreadcrumbItem><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage>{pageLabel}</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb><span className="workspace-private"><ShieldCheck size={15} aria-hidden="true" />Your team’s space</span></header>
      <header className="workspace-mobile-toolbar">
        <Sheet open={mobile} onOpenChange={setMobile}><SheetTrigger asChild><Button variant="ghost" size="icon" aria-label="Open navigation"><Menu size={20} /></Button></SheetTrigger><SheetContent side="left" className="workspace-mobile-sheet turnfin-refunds" aria-describedby="refund-nav-description"><SheetTitle className="sr-only">Refunds navigation</SheetTitle><SheetDescription className="sr-only" id="refund-nav-description">Open requests, follow up with finance and return to Turnfin modules.</SheetDescription>{navigation(true)}</SheetContent></Sheet>
        <Link href="/refunds" aria-label="Turnfin Refunds overview"><Brand module="Refunds" /></Link><AppearanceMenu />
        {who.request && <Button asChild size="icon"><Link href="/refunds/new" aria-label="New request"><Plus size={18} /></Link></Button>}
      </header>
      <main id="refund-main" ref={page} tabIndex={-1} className="workspace-page"><div className="page-content workspace-page-content"><div className="refund-content">{children}</div><footer className="app-footer"><span>Turnfin Refunds</span><span className="brand-values">People. Places. Progress.</span></footer></div></main>
    </div>
  </SidebarProvider></div>;
}
