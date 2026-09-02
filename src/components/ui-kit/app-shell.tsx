"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LucideIcon, LogOut, Menu, PanelLeft, PanelLeftClose } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/** The workspace shell: a tinted sidebar that stays put and a content column
 *  that scrolls. Those two surfaces are the whole chrome — there is no top bar
 *  on desktop, no breadcrumb, and no card around the page. Colours come from
 *  the sidebar and background tokens, in whichever mode is on.
 *
 *  Nav items are passed in rather than declared here, because which sections
 *  exist and who may see them is the app's business, not the shell's. Filter
 *  the array by permission at the layout that renders this. */

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** A count worth interrupting someone for. Renders as a red tint pill. */
  badge?: number;
};

/** How the switcher is being shown, so it can shrink to fit: to the icon
 *  rail when the desktop sidebar is collapsed, or into the phone bar. */
export type SwitcherState = { collapsed: boolean; compact: boolean };

export type AppShellProps = {
  /** Product name. Rendered as type plus a blue dot — no logo asset. */
  wordmark: string;
  items: NavItem[];
  userName: string;
  /** The line under the name in the account menu: role, team, tenant. */
  userSubtitle?: string;
  onSignOut?: () => void;
  /** Optional control pinned above the nav — a tenant/workspace switcher. A
   *  function is told how it is being shown. On a phone it goes in the bar
   *  beside the wordmark rather than inside the sheet, so it never leaves the
   *  screen. */
  switcher?: React.ReactNode | ((state: SwitcherState) => React.ReactNode);
  /** Small controls that must never be more than one click away — the
   *  light/dark flip. Rendered above the account menu on desktop (icon-only
   *  when collapsed) and at the right end of the bar on mobile, where they are
   *  reachable without opening the sheet. */
  tools?: React.ReactNode;
};

function renderSwitcher(switcher: AppShellProps["switcher"], state: SwitcherState) {
  return typeof switcher === "function" ? switcher(state) : switcher;
}

function Wordmark({ label }: { label: string }) {
  return (
    <Link href="/" className="flex items-baseline gap-0.5 select-none">
      <span className="text-[15px] font-semibold tracking-tight text-foreground">{label}</span>
      <span className="size-1.5 translate-y-px rounded-full bg-primary" aria-hidden />
    </Link>
  );
}

function NavList({
  items,
  collapsed,
  onNavigate,
}: {
  items: NavItem[];
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 overflow-y-auto px-2 py-1" aria-label="Main">
      <ul className="space-y-px">
        {items.map((item) => {
          const Icon = item.icon;
          // "/" would prefix-match everything, so it alone is matched exactly.
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13.5px] font-medium transition-colors",
                  // The same ring every button and input shows, so keyboard
                  // focus looks like one thing across the app instead of the
                  // browser default here and the token everywhere else.
                  "outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50",
                  collapsed && "justify-center px-0",
                  active
                    ? "bg-sidebar-accent text-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                )}
              >
                {/* The active item thickens its icon stroke rather than
                 *  changing colour — weight carries state, the accent is
                 *  reserved for the primary action. */}
                <Icon className="size-4 shrink-0" strokeWidth={active ? 2.2 : 1.8} />
                {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                {!collapsed && item.badge ? (
                  <span className="rounded-full bg-(--tag-red-bg) px-1.5 text-[11px] font-semibold leading-4 text-(--tag-red-fg)">
                    {item.badge}
                  </span>
                ) : null}
                {collapsed && item.badge ? (
                  <span
                    className="absolute mt-[-10px] ml-5 size-1.5 rounded-full bg-(--tag-red-fg)"
                    aria-hidden
                  />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function UserMenu({
  userName,
  userSubtitle,
  onSignOut,
  collapsed,
}: Pick<AppShellProps, "userName" | "userSubtitle" | "onSignOut"> & { collapsed?: boolean }) {
  const initials = userName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");

  return (
    <div className="border-t border-sidebar-border p-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-sidebar-accent",
            collapsed && "justify-center px-0"
          )}
          aria-label="Account menu"
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-(--tag-blue-bg) text-[11px] font-semibold text-(--tag-blue-fg)">
            {initials}
          </span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium text-foreground">
                {userName}
              </span>
              {userSubtitle ? (
                <span className="block truncate text-xs text-muted-foreground">{userSubtitle}</span>
              ) : null}
            </span>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuLabel className="font-normal">
            <span className="block text-[13px] font-medium">{userName}</span>
            {userSubtitle ? (
              <span className="block text-xs text-muted-foreground">{userSubtitle}</span>
            ) : null}
          </DropdownMenuLabel>
          {onSignOut ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onSignOut}>
                <LogOut className="size-4" />
                Sign out
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** Desktop sidebar. Hidden below md, where MobileNav takes over. */
export function Sidebar(props: AppShellProps) {
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-svh shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 max-md:hidden",
        collapsed ? "w-13" : "w-60"
      )}
    >
      <div className={cn("flex h-12 items-center gap-2 px-3", collapsed && "justify-center px-0")}>
        {!collapsed && <Wordmark label={props.wordmark} />}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "rounded p-1 text-muted-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-foreground",
            !collapsed && "ml-auto"
          )}
        >
          {collapsed ? <PanelLeft className="size-4" /> : <PanelLeftClose className="size-4" />}
        </button>
      </div>
      {props.switcher ? (
        <div className={cn("px-2 pb-2", collapsed && "flex justify-center px-0")}>
          {renderSwitcher(props.switcher, { collapsed, compact: false })}
        </div>
      ) : null}
      <NavList items={props.items} collapsed={collapsed} />
      {props.tools ? (
        <div
          className={cn(
            "flex items-center gap-1 px-2 pb-1",
            collapsed ? "justify-center px-0" : "justify-end"
          )}
        >
          {props.tools}
        </div>
      ) : null}
      <UserMenu {...props} collapsed={collapsed} />
    </aside>
  );
}

/** Below md the sidebar is replaced outright, never squeezed: a 48px bar and
 *  the same nav inside a sheet. */
export function MobileNav(props: AppShellProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b bg-sidebar px-3 md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-72 bg-sidebar p-0">
          <SheetHeader className="h-12 justify-center px-3">
            <SheetTitle asChild>
              <div>
                <Wordmark label={props.wordmark} />
              </div>
            </SheetTitle>
          </SheetHeader>
          <NavList items={props.items} onNavigate={() => setOpen(false)} />
          <UserMenu {...props} />
        </SheetContent>
      </Sheet>
      <Wordmark label={props.wordmark} />
      {props.switcher ? (
        <div className="flex min-w-0 flex-1 items-center">
          {renderSwitcher(props.switcher, { collapsed: false, compact: true })}
        </div>
      ) : null}
      {props.tools ? <div className="ml-auto flex items-center gap-1">{props.tools}</div> : null}
    </div>
  );
}

/** Wrap children in the content column: centred, 32/40 padding, tighter on
 *  phones. Pair with <Sidebar/> and <MobileNav/> in the app layout. */
export function AppFrame({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" tabIndex={-1} className="min-w-0 flex-1 outline-none">
      {/* `id` is the skip link's target; `tabIndex={-1}` lets it take focus
          without joining the tab order. */}
      <div className="mx-auto max-w-6xl px-8 py-10 max-md:px-4 max-md:py-6">{children}</div>
    </main>
  );
}
