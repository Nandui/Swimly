'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { signOut } from 'next-auth/react';
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, ShieldCheck, type LucideIcon } from 'lucide-react';
import { Sidebar, SidebarProvider, SidebarMenuButton } from '@/components/shadcn/sidebar';
import { Button } from '@/components/shadcn/button';
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from '@/components/shadcn/breadcrumb';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/docs/primitives/sheet';
import { Brand } from '@/components/workspace/brand';
import { AppearanceMenu } from '@/components/docs/appearance-menu';
import { Avatar } from '@/components/docs/ui';
import { Notice } from '@/components/ui-kit/notice';
import { HelpButton, HomeButton, YourModulesNav } from '@/components/workspace/your-modules';

export type ModuleLink = { href: string; label: string; icon: LucideIcon; active: boolean };
export type ModuleLinkGroup = { label: string; links: ModuleLink[] };

/** The one frame every module opens in (docs/how-turnfin-works.md). The
 *  sidebar shows one list at a time: on the home page the person's modules;
 *  inside a module that module's own pages, with "Back to Hub" in the footer. Also a
 *  breadcrumb, the mobile sheet and a remembered collapse preference. Links are presentation; every page checks
 *  its permission again. The pool deck keeps its own tablet frame. */
export function ModuleShell({ module, id, current = id, who, links = [], groups, tools, scopeNote, pageLabel, initialCollapsed = false, base = `/${id}`, contentClass = 'module-content', maxWidth, scrollKey = '', children }: {
  /** Display name, e.g. "Training". */
  module: string;
  /** Short id for the scope class, cookie and landmarks, e.g. "training". */
  id: string;
  /** The module id marked in "Your modules" ("home" on the home page). */
  current?: string;
  who: { id: string; name: string };
  /** The module's own pages, as one list… */
  links?: ModuleLink[];
  /** …or as several named groups. */
  groups?: ModuleLinkGroup[];
  /** Module controls under the brand, e.g. the swim school's site and
   *  swimmer search. Shown when the sidebar is expanded and in the phone sheet. */
  tools?: ReactNode;
  scopeNote: string;
  pageLabel: string;
  initialCollapsed?: boolean;
  /** Where the brand and breadcrumb lead. The home page itself is "/". */
  base?: string;
  contentClass?: string;
  /** Caps the page's width; without it the module's stylesheet decides. */
  maxWidth?: number;
  /** Scroll back to the top when this changes as well as the path (filters). */
  scrollKey?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed), [mobile, setMobile] = useState(false);
  const [leaving, setLeaving] = useState(false), [error, setError] = useState('');
  const page = useRef<HTMLElement>(null);
  useEffect(() => { page.current?.scrollTo({ top: 0 }); }, [pathname, scrollKey]);
  // Arriving on another page (a link, or the swimmer search) closes the phone menu.
  const [shownPath, setShownPath] = useState(pathname);
  if (shownPath !== pathname) { setShownPath(pathname); setMobile(false); }
  const onHome = current === 'home';
  const sections = groups ?? (links.length ? [{ label: '', links }] : []);
  function changeCollapsed(value: boolean) {
    setCollapsed(value);
    document.cookie = `turnfin.${id}.sidebar=${value ? 'collapsed' : 'expanded'}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }
  function navigation(inSheet: boolean) {
    const compact = collapsed && !inSheet;
    const close = () => setMobile(false);
    const item = (entry: ModuleLink) => <SidebarMenuButton key={entry.label} asChild><Link href={entry.href} className="workspace-nav-item" aria-label={entry.label} title={compact ? entry.label : undefined} aria-current={entry.active ? 'page' : undefined} onClick={close}><entry.icon size={18} aria-hidden="true" data-motion="sidebar-icon" /><span>{entry.label}</span></Link></SidebarMenuButton>;
    return <>
      <div className="workspace-sidebar-header">
        <div className="workspace-brand-row"><Link href={base} aria-label={`Turnfin ${module}`} onClick={close}><Brand module={module} /></Link>{!inSheet && <Button variant="ghost" size="icon" aria-label={compact ? 'Expand navigation' : 'Collapse navigation'} aria-expanded={!compact} onClick={() => changeCollapsed(!collapsed)}>{compact ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</Button>}</div>
        {!onHome && !compact && tools && <div className="workspace-tools">{tools}</div>}
      </div>
      <nav className="workspace-navigation" aria-label={inSheet ? `Mobile ${module} navigation` : `${module} navigation`}>
        {onHome && <YourModulesNav compact={compact} onNavigate={close} />}
        {sections.map((section) => <div key={section.label} className="contents">{section.label && <p className="workspace-nav-label">{section.label}</p>}{section.links.map(item)}</div>)}
      </nav>
      <div className="workspace-sidebar-footer">
        {!onHome && <HomeButton compact={compact} onNavigate={close} />}
        <div className="workspace-footer-row"><HelpButton compact={compact} /><AppearanceMenu /></div>
        {error && <Notice tone="error" title={error} />}
        <div className="workspace-profile">{!compact && <Link href="/account" className="workspace-account" aria-label={`Your account: ${who.name}`} onClick={close}><Avatar member={who} /><div><strong>{who.name}</strong><span>Your account</span></div></Link>}<Button variant="ghost" size="icon" aria-label="Sign out" title="Sign out" disabled={leaving} onClick={async () => { setLeaving(true); setError(''); try { await signOut({ redirectTo: '/sign-in' }); } catch { setLeaving(false); setError('Could not sign out. Please try again.'); } }}><LogOut size={17} /></Button></div>
      </div>
    </>;
  }
  return <div className={`turnfin-docs turnfin-module turnfin-${id}`}><SidebarProvider open={!collapsed} onOpenChange={open => changeCollapsed(!open)} className="app-shell turnfin-workspace" data-collapsed={collapsed}>
    <a className="skip-link" href={`#${id}-main`}>Skip to content</a>
    <Sidebar collapsible="none" className="workspace-sidebar" data-collapsed={collapsed}>{navigation(false)}</Sidebar>
    <div className="workspace-surface">
      <header className="workspace-topbar"><Breadcrumb className="workspace-breadcrumb"><BreadcrumbList>{current !== 'home' && <><BreadcrumbItem><BreadcrumbLink asChild><Link href="/">Hub</Link></BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator /></>}<BreadcrumbItem><BreadcrumbLink asChild><Link href={base}>{module}</Link></BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage>{pageLabel}</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb><span className="workspace-private"><ShieldCheck size={15} aria-hidden="true" />{scopeNote}</span></header>
      <header className="workspace-mobile-toolbar">
        <Sheet open={mobile} onOpenChange={setMobile}><SheetTrigger asChild><Button variant="ghost" size="icon" aria-label="Open navigation"><Menu size={20} /></Button></SheetTrigger><SheetContent side="left" className={`workspace-mobile-sheet turnfin-module turnfin-${id}`} aria-describedby={`${id}-nav-description`}><SheetTitle className="sr-only">{module} navigation</SheetTitle><SheetDescription className="sr-only" id={`${id}-nav-description`}>Your modules and the {module} pages.</SheetDescription>{navigation(true)}</SheetContent></Sheet>
        <Link href={base} aria-label={`Turnfin ${module}`}><Brand module={module} /></Link><AppearanceMenu />
      </header>
      <main id={`${id}-main`} ref={page} tabIndex={-1} className="workspace-page"><div className="page-content workspace-page-content"><div className={contentClass} style={maxWidth ? { maxWidth } : undefined}>{children}</div><footer className="app-footer"><span>Turnfin {module}</span><span className="brand-values">People. Places. Progress.</span></footer></div></main>
    </div>
  </SidebarProvider></div>;
}
