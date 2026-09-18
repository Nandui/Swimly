'use client';
import { Input } from '@/components/shadcn/input';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Home,
  Library,
  ClipboardCheck,
  ChartNoAxesCombined,
  Settings,
  Search,
  Plus,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  LifeBuoy,
  Building2,
  ShieldCheck,
} from 'lucide-react';
import { canWrite, canManage, type Workspace } from '@/lib/docs/types';
import { signOut } from 'next-auth/react';
import { Avatar, Message } from './ui';
import { Sidebar, SidebarProvider, SidebarMenuButton } from '@/components/shadcn/sidebar';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/shadcn/breadcrumb';
import { Button } from '@/components/shadcn/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/docs/primitives/sheet';
import { Brand } from './brand';
import { AppearanceMenu } from './appearance-menu';

const nav = [
  { href: '/docs', label: 'Home', icon: Home },
  { href: '/docs/library', label: 'Document library', icon: Library },
  { href: '/docs/work', label: 'My work', icon: ClipboardCheck },
  { href: '/docs/reports', label: 'Reading reports', icon: ChartNoAxesCombined },
];
export function Shell({
  workspace: w,
  initialCollapsed = false,
  children,
}: {
  workspace: Pick<Workspace, 'member' | 'localMode'> & { outstandingReading: number };
  initialCollapsed?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const query = useSearchParams();
  const [error, setError] = useState('');
  const [mobile, setMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [leaving, setLeaving] = useState(false);
  const page = useRef<HTMLElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const pageLabel = pathname.startsWith('/docs/documents')
    ? 'Documents'
    : pathname.startsWith('/docs/admin')
      ? 'Administration'
      : nav.find((item) => item.href === pathname)?.label || 'Workspace';
  useEffect(() => {
    page.current?.scrollTo({ top: 0 });
  }, [pathname]);
  function changeCollapsed(value: boolean) {
    setCollapsed(value);
    document.cookie = `turnfin.sidebar=${value ? 'collapsed' : 'expanded'}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }
  function navigation(inSheet: boolean) {
    const compact = collapsed && !inSheet;
    return (
      <>
        <div className="workspace-sidebar-header">
          <div className="workspace-brand-row">
            <Link href="/docs" aria-label="Turnfin Docs overview" onClick={() => setMobile(false)}>
              <Brand />
            </Link>
            {!inSheet && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={compact ? 'Expand navigation' : 'Collapse navigation'}
                aria-expanded={!compact}
                title={compact ? 'Expand navigation' : 'Collapse navigation'}
                onClick={() => changeCollapsed(!collapsed)}
              >
                {compact ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
              </Button>
            )}
          </div>
          {!compact && (
            <div className="workspace-organisation">
              <Building2 size={18} />
              <div>
                <strong>LeisureWorld</strong>
                <span>Team workspace</span>
              </div>
            </div>
          )}
          {compact ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Search documents"
              title="Search documents"
              onClick={() => {
                changeCollapsed(false);
                requestAnimationFrame(() => search.current?.focus());
              }}
            >
              <Search size={18} />
            </Button>
          ) : (
            <form className="workspace-search" action="/docs/library" onSubmit={() => setMobile(false)}>
              <Search size={17} aria-hidden="true" />
              <Input
                ref={inSheet ? undefined : search}
                type="search"
                name="q"
                aria-label="Search all documents"
                placeholder="Search documents…"
              />
            </form>
          )}
          {canWrite(w.member) && (
            <Button asChild size={compact ? 'icon' : 'default'} className="workspace-create">
              <Link
                href="/docs/documents/new"
                aria-label="New document"
                title={compact ? 'New document' : undefined}
                onClick={() => setMobile(false)}
              >
                <Plus size={18} />
                {!compact && <span>New document</span>}
              </Link>
            </Button>
          )}
        </div>
        <nav
          className="workspace-navigation"
          aria-label={inSheet ? 'Mobile navigation' : 'Main navigation'}
        >
          <p className="workspace-nav-label">Workspace</p>
          {nav
            .filter((item) => item.href !== '/docs/reports' || canWrite(w.member))
            .map((item) => {
              const active =
                item.href === '/docs'
                  ? pathname === '/docs'
                  : pathname.startsWith(item.href) &&
                    !(
                      item.href === '/docs/library' &&
                      ['EAP', 'Policy'].includes(query.get('type') || '')
                    );
              const Icon = item.icon;
              return (
                <SidebarMenuButton asChild key={item.href}>
                  <Link
                    href={item.href}
                    className="workspace-nav-item"
                    aria-label={
                      item.href === '/docs/work' && w.outstandingReading > 0
                        ? `${item.label}, ${w.outstandingReading} to read`
                        : item.label
                    }
                    title={compact ? item.label : undefined}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setMobile(false)}
                  >
                    <Icon size={18} data-motion="sidebar-icon" />
                    <span>{item.label}</span>
                    {item.href === '/docs/work' && w.outstandingReading > 0 && (
                      <span className="workspace-nav-count">{w.outstandingReading}</span>
                    )}
                  </Link>
                </SidebarMenuButton>
              );
            })}
          <p className="workspace-nav-label">Quick access</p>
          {[
            { type: 'EAP', label: 'Emergency plans', Icon: LifeBuoy },
            { type: 'Policy', label: 'Policies', Icon: BookOpen },
          ].map(({ type, label, Icon }) => (
            <SidebarMenuButton asChild key={type}>
              <Link
                href={`/docs/library?type=${type}`}
                className="workspace-nav-item"
                aria-label={label}
                title={compact ? label : undefined}
                aria-current={
                  pathname === '/docs/library' && query.get('type') === type ? 'page' : undefined
                }
                onClick={() => setMobile(false)}
              >
                <Icon size={18} data-motion="sidebar-icon" />
                <span>{label}</span>
              </Link>
            </SidebarMenuButton>
          ))}
          {canManage(w.member) && (
            <>
              <p className="workspace-nav-label">Manage</p>
              <SidebarMenuButton asChild>
                <Link
                  href="/docs/admin"
                  className="workspace-nav-item"
                  aria-label="Administration"
                  title={compact ? 'Administration' : undefined}
                  aria-current={pathname.startsWith('/docs/admin') ? 'page' : undefined}
                  onClick={() => setMobile(false)}
                >
                  <Settings size={18} data-motion="sidebar-icon" />
                  <span>Administration</span>
                </Link>
              </SidebarMenuButton>
            </>
          )}
        </nav>
        <div className="workspace-sidebar-footer">
          <Button asChild variant="ghost"><Link href="/modules" aria-label="All modules">←{!compact && " All modules"}</Link></Button>
          <AppearanceMenu expanded={!compact} />
          <Message error={error} />
          {!compact && w.localMode && <span className="workspace-local">Local workspace</span>}
          <div className="workspace-profile">
            {!compact && (
              <>
                <Avatar member={w.member} />
                <div>
                  <strong>{w.member.name}</strong>
                  <span>{w.member.role}</span>
                </div>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Sign out"
              title="Sign out"
              disabled={leaving}
              onClick={async () => {
                setLeaving(true);
                try { await signOut({ redirectTo: '/sign-in' }); }
                catch { setLeaving(false); setError('Could not sign out. Please try again.'); }
              }}
            >
              <LogOut size={17} />
            </Button>
          </div>
        </div>
      </>
    );
  }
  return (
    <SidebarProvider
      open={!collapsed}
      onOpenChange={(open) => changeCollapsed(!open)}
      className="app-shell turnfin-workspace"
      data-collapsed={collapsed}
    >
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Sidebar collapsible="none" className="workspace-sidebar" data-collapsed={collapsed}>
        {navigation(false)}
      </Sidebar>
      <div className="workspace-surface">
        <header className="workspace-topbar">
          <Breadcrumb className="workspace-breadcrumb">
            <BreadcrumbList>
              <BreadcrumbItem>LeisureWorld</BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{pageLabel}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <span className="workspace-private">
            <ShieldCheck size={15} aria-hidden="true" />
            Your team’s space
          </span>
        </header>
        <header className="workspace-mobile-toolbar">
          <Sheet open={mobile} onOpenChange={setMobile}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open navigation">
                <Menu size={20} />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="workspace-mobile-sheet"
              aria-describedby="mobile-nav-description"
            >
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SheetDescription className="sr-only" id="mobile-nav-description">
                Find documents and manage your workspace.
              </SheetDescription>
              {navigation(true)}
            </SheetContent>
          </Sheet>
          <Link href="/docs" aria-label="Turnfin Docs overview">
            <Brand />
          </Link>
          <AppearanceMenu />
          {canWrite(w.member) && (
            <Button asChild size="icon">
              <Link href="/docs/documents/new" aria-label="New document">
                <Plus size={18} />
              </Link>
            </Button>
          )}
        </header>
        <main id="main" ref={page} tabIndex={-1} className="workspace-page">
          <div className="page-content workspace-page-content">
            {children}
            <footer className="app-footer">
              <span>Turnfin Docs</span>
              <span className="brand-values">People. Places. Progress.</span>
            </footer>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
