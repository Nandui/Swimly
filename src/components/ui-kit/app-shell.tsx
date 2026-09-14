"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronsUpDown, CircleHelp, CircleUser, LogOut, X, type LucideIcon } from "lucide-react";
import { AppLogo } from "@/components/app-logo";
import { Badge } from "@/components/shadcn/badge";
import { Button } from "@/components/shadcn/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/shadcn/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/shadcn/dropdown-menu";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarSeparator, SidebarTrigger, useSidebar } from "@/components/shadcn/sidebar";
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
  return <div className="shadcn-workspace workspace-inset flex h-dvh flex-col overflow-hidden bg-ui-workspace text-ui-foreground">
    <a href="#workspace-main" className="sr-only fixed left-4 top-4 z-50 rounded-ui-md bg-ui-primary p-3 text-ui-primary-foreground focus:not-sr-only">Skip to content</a>
    {props.banner}
    <SidebarProvider open={open} onOpenChange={changeOpen} className="relative min-h-0 flex-1 overflow-hidden">
      <WorkspaceSidebar {...props} />
      <SidebarInset id="workspace-main" tabIndex={-1} className="min-w-0 overflow-hidden md:bg-ui-card md:ring-1 md:ring-ui-border/50 md:peer-data-[variant=inset]:shadow-md">
        <MobileWorkspaceToolbar {...props} />
        <div id={SHELL_PAGE_ID} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 lg:p-6">
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
  return <Sidebar variant="inset" collapsible="icon" aria-label="Main navigation">
    <SidebarHeader className="gap-4 p-3 pb-4 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:gap-3 group-data-[collapsible=icon]:px-0">
      <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:flex-col">
        <Link href={props.homeHref ?? "/"} aria-label={props.wordmark} onClick={() => setOpenMobile(false)} className="flex min-h-11 min-w-11 items-center gap-2 font-semibold group-data-[collapsible=icon]:justify-center">
          <AppLogo className="group-data-[collapsible=icon]:size-8" /><span className="group-data-[collapsible=icon]:hidden">{props.wordmark}</span>
        </Link>
        {isMobile ? <Button variant="ghost" size="icon" className="size-11" aria-label="Close navigation" onClick={() => setOpenMobile(false)}><X aria-hidden="true" /></Button> : <SidebarTrigger aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} className="size-11 shrink-0" />}
      </div>
      {props.switcher || props.search ? <div className="flex w-full min-w-0 flex-col gap-2 group-data-[collapsible=icon]:items-center" aria-label="Workspace controls">
        {props.switcher}
        {props.search}
      </div> : null}
    </SidebarHeader>
    <SidebarSeparator className="mx-3 data-[orientation=horizontal]:w-auto group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:data-[orientation=horizontal]:w-6" />
    <SidebarContent className="px-3 py-4 group-data-[collapsible=icon]:overflow-auto group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:[scrollbar-width:none]"><nav aria-label="Daily work and setup" className="space-y-6 group-data-[collapsible=icon]:space-y-4">
      {props.groups.map(group => <NavigationGroup key={`${group.id}:${group.items.some(item => isNavItemActive(pathname, item.href))}`} group={group} pathname={pathname} collapsed={collapsed} />)}
    </nav></SidebarContent>
    <SidebarFooter className="border-t border-ui-border p-3 group-data-[collapsible=icon]:px-0">
      <SidebarMenu className="group-data-[collapsible=icon]:items-center"><SidebarMenuItem><SidebarMenuButton asChild className="h-11 px-3" tooltip="Help centre (opens in a new tab)">
        <Link href="/help" target="_blank" rel="noopener noreferrer" aria-label="Help centre (opens in a new tab)"><CircleHelp aria-hidden="true" /><span className="group-data-[collapsible=icon]:hidden">Help centre</span></Link>
      </SidebarMenuButton></SidebarMenuItem></SidebarMenu>
      <div className="flex min-w-0 items-center gap-2 group-data-[collapsible=icon]:flex-col-reverse">
        <div className="min-w-0 flex-1 group-data-[collapsible=icon]:flex-none"><AccountMenu {...props} /></div>
        {props.tools ? <div className="shrink-0 [&>button]:size-11">{props.tools}</div> : null}
      </div>
    </SidebarFooter>
  </Sidebar>;
}

function NavigationGroup({ group, pathname, collapsed }: { group: NavGroup; pathname: string; collapsed: boolean }) {
  const { setOpenMobile } = useSidebar();
  const active = group.items.some(item => isNavItemActive(pathname, item.href));
  const GroupIcon = group.icon;
  const items = <SidebarMenu className="group-data-[collapsible=icon]:items-center">{group.items.map(item => <SidebarMenuItem key={item.href}>
    <SidebarMenuButton className="h-11 px-3" asChild isActive={isNavItemActive(pathname, item.href)} tooltip={item.label}>
      <Link href={item.href} aria-label={item.label} aria-current={isNavItemActive(pathname, item.href) ? "page" : undefined} onClick={() => setOpenMobile(false)}>
        <span data-motion="sidebar-icon" className="size-4 shrink-0" aria-hidden="true"><item.icon className="size-full" /></span><span className="group-data-[collapsible=icon]:hidden">{item.label}</span>{item.badge ? <Badge variant="secondary" className="ml-auto group-data-[collapsible=icon]:hidden">{item.badge}</Badge> : null}
      </Link>
    </SidebarMenuButton>
  </SidebarMenuItem>)}</SidebarMenu>;
  if (!group.collapsible) return <SidebarGroup className="p-0"><SidebarGroupLabel className="mb-2 h-auto px-3 py-1 group-data-[collapsible=icon]:hidden">{group.label}</SidebarGroupLabel>{items}</SidebarGroup>;
  if (collapsed) return <SidebarGroup className="items-center p-0"><SidebarMenu className="items-center"><SidebarMenuItem>
    <DropdownMenu><DropdownMenuTrigger asChild><SidebarMenuButton className="h-11 px-3" tooltip={group.label} aria-label={group.label} isActive={active}>{GroupIcon ? <GroupIcon aria-hidden="true" /> : null}<span className="group-data-[collapsible=icon]:hidden">{group.label}</span></SidebarMenuButton></DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start"><DropdownMenuLabel>{group.label}</DropdownMenuLabel>{group.items.map(item => <DropdownMenuItem asChild key={item.href}><Link href={item.href}><item.icon aria-hidden="true" />{item.label}</Link></DropdownMenuItem>)}</DropdownMenuContent>
    </DropdownMenu>
  </SidebarMenuItem></SidebarMenu></SidebarGroup>;
  return <SidebarGroup className="p-0"><Collapsible defaultOpen={active} className="group/setup">
    <CollapsibleTrigger asChild><SidebarMenuButton className="h-11 px-3">{GroupIcon ? <GroupIcon aria-hidden="true" /> : null}<span>{group.label}</span><ChevronDown aria-hidden="true" className="ml-auto transition-transform group-data-[state=open]/setup:rotate-180" /></SidebarMenuButton></CollapsibleTrigger>
    <CollapsibleContent className="ml-5 border-l border-ui-border pl-3 pt-2">{items}</CollapsibleContent>
  </Collapsible></SidebarGroup>;
}

function MobileWorkspaceToolbar(props: Pick<AppShellProps, "switcher" | "tools">) {
  const { openMobile } = useSidebar();
  return <header className="flex shrink-0 items-center gap-2 border-b border-ui-border px-4 py-2 md:hidden" aria-label="Workspace tools">
    <SidebarTrigger data-mobile-trigger aria-label="Open navigation" aria-expanded={openMobile} className="size-11 shrink-0" />
    <div className="min-w-0 flex-1">{props.switcher}</div>
    <Button asChild variant="ghost" size="icon" className="size-11"><Link href="/help" target="_blank" rel="noopener noreferrer" aria-label="Help centre (opens in a new tab)"><CircleHelp aria-hidden="true" /></Link></Button>
    {props.tools ? <div className="shrink-0">{props.tools}</div> : null}
  </header>;
}

function AccountMenu({ userName, userSubtitle, onSignOut }: Pick<AppShellProps, "userName" | "userSubtitle" | "onSignOut">) {
  const { isMobile, state } = useSidebar();
  return <SidebarMenu><SidebarMenuItem><DropdownMenu>
    <DropdownMenuTrigger asChild><SidebarMenuButton size="lg" className="px-3" aria-label={`Account menu: ${userName}`} title={userName}>
      <CircleUser aria-hidden="true" /><span className="flex min-w-0 flex-1 flex-col group-data-[collapsible=icon]:hidden"><span className="truncate font-medium">{userName}</span><span className="truncate text-xs text-ui-muted-foreground">{userSubtitle}</span></span><ChevronsUpDown aria-hidden="true" className="ml-auto group-data-[collapsible=icon]:hidden" />
    </SidebarMenuButton></DropdownMenuTrigger>
    <DropdownMenuContent side={!isMobile && state === "collapsed" ? "right" : "top"} align="start" className="w-60">
      <DropdownMenuLabel>{userName}</DropdownMenuLabel><DropdownMenuSeparator />
      <DropdownMenuItem asChild><Link href="/account"><CircleUser aria-hidden="true" />Account</Link></DropdownMenuItem>
      <DropdownMenuItem onSelect={onSignOut} disabled={!onSignOut}><LogOut aria-hidden="true" />Sign out</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu></SidebarMenuItem></SidebarMenu>;
}
