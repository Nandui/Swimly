"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronsUpDown, CircleUser, LogOut, Waves, X, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/shadcn/badge";
import { Button } from "@/components/shadcn/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/shadcn/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/shadcn/dropdown-menu";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/shadcn/sidebar";
import { isNavItemActive } from "@/lib/nav";
import { NAV_COLLAPSED_COOKIE, SHELL_PAGE_ID } from "@/lib/shell-preferences";

export type NavItem = { href: string; label: string; icon: LucideIcon; badge?: number };
export type NavGroup = { id: string; label: string; icon?: LucideIcon; collapsible?: boolean; items: NavItem[] };
export type AppShellProps = {
  wordmark: string; homeHref?: string; groups: NavGroup[];
  userName: string; userSubtitle?: string; onSignOut?: () => void;
  switcher?: React.ReactNode; search?: React.ReactNode; tools?: React.ReactNode;
  banner?: React.ReactNode; initialCollapsed?: boolean; contentMaxWidth?: number;
  children: React.ReactNode;
};

export function AppShell(props: AppShellProps) {
  const [open, setOpen] = React.useState(!props.initialCollapsed);
  const pathname = usePathname();
  const search = useSearchParams().toString();
  React.useEffect(() => { document.getElementById(SHELL_PAGE_ID)?.scrollTo({ top: 0 }); }, [pathname, search]);
  function changeOpen(value: boolean) {
    setOpen(value);
    document.cookie = `${NAV_COLLAPSED_COOKIE}=${value ? "0" : "1"}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }
  return <div className="shadcn-workspace flex h-dvh flex-col overflow-hidden bg-ui-background text-ui-foreground">
    <a href="#workspace-main" className="sr-only fixed left-4 top-4 z-50 rounded-ui-md bg-ui-primary p-3 text-ui-primary-foreground focus:not-sr-only">Skip to content</a>
    {props.banner}
    <SidebarProvider open={open} onOpenChange={changeOpen} className="relative min-h-0 flex-1 overflow-hidden">
      <WorkspaceSidebar {...props} />
      <SidebarInset id="workspace-main" tabIndex={-1} className="min-w-0 overflow-hidden">
        <WorkspaceToolbar {...props} />
        <div id={SHELL_PAGE_ID} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          <div className="mx-auto w-full min-w-0" style={{ maxWidth: props.contentMaxWidth }}>{props.children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  </div>;
}

function WorkspaceSidebar(props: AppShellProps) {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const pathname = usePathname();
  const collapsed = state === "collapsed" && !isMobile;
  return <Sidebar collapsible="icon" aria-label="Main navigation">
    <SidebarHeader className="gap-3 p-3 group-data-[collapsible=icon]:px-2">
      <div className="flex items-center justify-between gap-2">
        <Link href={props.homeHref ?? "/"} aria-label={props.wordmark} onClick={() => setOpenMobile(false)} className="flex min-h-10 min-w-8 items-center gap-2 font-semibold">
          <Waves className="size-5 shrink-0" aria-hidden="true" /><span className="group-data-[collapsible=icon]:hidden">{props.wordmark}</span>
        </Link>
        {isMobile ? <Button variant="ghost" size="icon" aria-label="Close navigation" onClick={() => setOpenMobile(false)}><X aria-hidden="true" /></Button> : null}
      </div>
      {!collapsed ? props.switcher : null}
    </SidebarHeader>
    <SidebarContent><nav aria-label="Daily work and setup">
      {props.groups.map(group => <NavigationGroup key={`${group.id}:${group.items.some(item => isNavItemActive(pathname, item.href))}`} group={group} pathname={pathname} collapsed={collapsed} />)}
    </nav></SidebarContent>
    <SidebarFooter className="border-t border-ui-border"><AccountMenu {...props} /></SidebarFooter>
  </Sidebar>;
}

function NavigationGroup({ group, pathname, collapsed }: { group: NavGroup; pathname: string; collapsed: boolean }) {
  const { setOpenMobile } = useSidebar();
  const active = group.items.some(item => isNavItemActive(pathname, item.href));
  const GroupIcon = group.icon;
  const items = <SidebarMenu>{group.items.map(item => <SidebarMenuItem key={item.href}>
    <SidebarMenuButton asChild isActive={isNavItemActive(pathname, item.href)} tooltip={item.label}>
      <Link href={item.href} aria-current={isNavItemActive(pathname, item.href) ? "page" : undefined} onClick={() => setOpenMobile(false)}>
        <item.icon aria-hidden="true" /><span>{item.label}</span>{item.badge ? <Badge variant="secondary" className="ml-auto">{item.badge}</Badge> : null}
      </Link>
    </SidebarMenuButton>
  </SidebarMenuItem>)}</SidebarMenu>;
  if (!group.collapsible) return <SidebarGroup><SidebarGroupLabel>{group.label}</SidebarGroupLabel>{items}</SidebarGroup>;
  if (collapsed) return <SidebarGroup><SidebarMenu><SidebarMenuItem>
    <DropdownMenu><DropdownMenuTrigger asChild><SidebarMenuButton tooltip={group.label} aria-label={group.label} isActive={active}>{GroupIcon ? <GroupIcon aria-hidden="true" /> : null}<span>{group.label}</span></SidebarMenuButton></DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start"><DropdownMenuLabel>{group.label}</DropdownMenuLabel>{group.items.map(item => <DropdownMenuItem asChild key={item.href}><Link href={item.href}><item.icon aria-hidden="true" />{item.label}</Link></DropdownMenuItem>)}</DropdownMenuContent>
    </DropdownMenu>
  </SidebarMenuItem></SidebarMenu></SidebarGroup>;
  return <SidebarGroup><Collapsible defaultOpen={active} className="group/setup">
    <CollapsibleTrigger asChild><SidebarMenuButton>{GroupIcon ? <GroupIcon aria-hidden="true" /> : null}<span>{group.label}</span><ChevronDown aria-hidden="true" className="ml-auto transition-transform group-data-[state=open]/setup:rotate-180" /></SidebarMenuButton></CollapsibleTrigger>
    <CollapsibleContent className="pt-1">{items}</CollapsibleContent>
  </Collapsible></SidebarGroup>;
}

function WorkspaceToolbar(props: Pick<AppShellProps, "switcher" | "search" | "tools">) {
  const { state, isMobile, openMobile } = useSidebar();
  return <header className="flex shrink-0 flex-col border-b border-ui-border" aria-label="Workspace tools">
    <div className="flex min-h-14 items-center gap-2 px-4 py-2">
      <SidebarTrigger aria-label={isMobile ? "Open navigation" : state === "collapsed" ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={isMobile ? openMobile : state === "expanded"} className="size-9 shrink-0" />
      {isMobile || state === "collapsed" ? <div className="min-w-0 flex-1 md:max-w-72">{props.switcher}</div> : null}
      <div className="hidden min-w-0 flex-1 md:block"><div className="max-w-md">{props.search}</div></div>
      <div className="ml-auto shrink-0">{props.tools}</div>
    </div>
    {props.search ? <div className="px-4 pb-3 md:hidden">{props.search}</div> : null}
  </header>;
}

function AccountMenu({ userName, userSubtitle, onSignOut }: Pick<AppShellProps, "userName" | "userSubtitle" | "onSignOut">) {
  const { isMobile, state } = useSidebar();
  return <SidebarMenu><SidebarMenuItem><DropdownMenu>
    <DropdownMenuTrigger asChild><SidebarMenuButton size="lg" aria-label={`Account menu: ${userName}`}>
      <CircleUser aria-hidden="true" /><span className="flex min-w-0 flex-1 flex-col"><span className="truncate font-medium">{userName}</span><span className="truncate text-xs text-ui-muted-foreground">{userSubtitle}</span></span><ChevronsUpDown aria-hidden="true" className="ml-auto" />
    </SidebarMenuButton></DropdownMenuTrigger>
    <DropdownMenuContent side={!isMobile && state === "collapsed" ? "right" : "top"} align="start" className="w-60">
      <DropdownMenuLabel>{userName}</DropdownMenuLabel><DropdownMenuSeparator />
      <DropdownMenuItem asChild><Link href="/account"><CircleUser aria-hidden="true" />Account</Link></DropdownMenuItem>
      <DropdownMenuItem onSelect={onSignOut} disabled={!onSignOut}><LogOut aria-hidden="true" />Sign out</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu></SidebarMenuItem></SidebarMenu>;
}
