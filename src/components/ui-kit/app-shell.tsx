"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CircleUser, LogOut, Waves, type LucideIcon } from "lucide-react";
import { AppShell as AstryxAppShell, useAppShellMobile } from "@astryxdesign/core/AppShell";
import { Badge } from "@astryxdesign/core/Badge";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { Icon } from "@astryxdesign/core/Icon";
import { SideNav, SideNavHeading, SideNavItem, SideNavSection } from "@astryxdesign/core/SideNav";
import { HStack, StackItem, VStack } from "@astryxdesign/core/Stack";
import { isNavItemActive } from "@/lib/nav";
import { NAV_COLLAPSED_COOKIE, SHELL_PAGE_ID } from "@/lib/shell-preferences";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** A count worth interrupting someone for. */
  badge?: number;
};

export type NavGroup = {
  id: string;
  label: string;
  icon?: LucideIcon;
  collapsible?: boolean;
  items: NavItem[];
};

export type AppShellProps = {
  wordmark: string;
  homeHref?: string;
  groups: NavGroup[];
  userName: string;
  userSubtitle?: string;
  onSignOut?: () => void;
  /** A named club control: sidebar on desktop, utility bar on mobile/rail. */
  switcher?: React.ReactNode;
  search?: React.ReactNode;
  tools?: React.ReactNode;
  banner?: React.ReactNode;
  initialCollapsed?: boolean;
  /** Leave undefined for data workspaces; cap forms and detail pages. */
  contentMaxWidth?: number;
  children: React.ReactNode;
};

/** One full-height navigation region and one flat page surface. Astryx owns
 *  the main landmark, skip link, mobile drawer, focus trap and Escape key.
 *  The utility header stays above the page's independent scroll region. */
export function AppShell(props: AppShellProps) {
  const [collapsed, setCollapsed] = React.useState(props.initialCollapsed ?? false);
  useScrollToTopOnNavigate();

  function changeCollapsed(value: boolean) {
    setCollapsed(value);
    document.cookie = `${NAV_COLLAPSED_COOKIE}=${value ? "1" : "0"}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }

  return (
    <AstryxAppShell
      height="fill"
      variant="section"
      contentPadding={0}
      banner={props.banner}
      mobileNav={{ breakpoint: "md" }}
      sideNav={<WorkspaceNavigation {...props} collapsed={collapsed} onCollapsedChange={changeCollapsed} />}
    >
      <VStack height="100%" gap={0} minHeight={0}>
        <WorkspaceToolbar {...props} collapsed={collapsed} />
        <StackItem id={SHELL_PAGE_ID} size="fill" isScrollable>
          <VStack padding={4} hAlign="center">
            {/* Tables bleed to a container edge. This column is that edge,
                keeping tables aligned with the page heading and filters. */}
            <VStack
              width="100%"
              maxWidth={props.contentMaxWidth}
              className="[--container-padding-inline-start:0px] [--container-padding-inline-end:0px]"
            >
              {props.children}
            </VStack>
          </VStack>
        </StackItem>
      </VStack>
    </AstryxAppShell>
  );
}

function WorkspaceNavigation(props: AppShellProps & {
  collapsed: boolean;
  onCollapsedChange: (value: boolean) => void;
}) {
  const { isMobile } = useAppShellMobile();
  const pathname = usePathname();
  const collapsed = !isMobile && props.collapsed;

  return (
    <SideNav
      aria-label="Main navigation"
      className="bg-body"
      collapsible={isMobile ? false : {
        isCollapsed: collapsed,
        onCollapsedChange: props.onCollapsedChange,
      }}
      header={isMobile ? (
        <HStack gap={2} vAlign="center" width="100%" className="min-w-0">
          <StackItem size="fill">{props.switcher}</StackItem>
          <StackItem>{props.tools}</StackItem>
        </HStack>
      ) : (
        <SideNavHeading
          heading={props.wordmark}
          headingHref={props.homeHref ?? "/"}
          icon={collapsed ? <Icon icon={Waves} size="sm" /> : undefined}
        />
      )}
      topContent={!isMobile && !collapsed ? props.switcher : undefined}
      footer={collapsed ? undefined : <AccountMenu {...props} />}
      footerIcons={collapsed ? <AccountMenu {...props} compact /> : undefined}
    >
      {props.groups.map(group => (
        <NavigationGroup
          key={`${group.id}:${group.items.some(item => isNavItemActive(pathname, item.href))}`}
          group={group}
          pathname={pathname}
          isRail={collapsed}
        />
      ))}
    </SideNav>
  );
}

function NavigationGroup({ group, pathname, isRail }: { group: NavGroup; pathname: string; isRail: boolean }) {
  const hasActiveItem = group.items.some(item => isNavItemActive(pathname, item.href));
  const items = group.items.map(item => (
    <SideNavItem
      key={item.href}
      label={item.label}
      href={item.href}
      icon={item.icon}
      isSelected={isNavItemActive(pathname, item.href)}
      endContent={item.badge ? <Badge variant="red" label={item.badge} /> : undefined}
    />
  ));

  return (
    <SideNavSection title={group.label} isHeaderHidden={group.collapsible}>
      {group.collapsible ? (
        <SideNavItem
          label={group.label}
          icon={group.icon}
          isSelected={isRail && hasActiveItem}
          aria-current={isRail && hasActiveItem ? "location" : undefined}
          collapsible={{ defaultIsCollapsed: !hasActiveItem }}
        >
          {items}
        </SideNavItem>
      ) : items}
    </SideNavSection>
  );
}

function WorkspaceToolbar(props: Pick<AppShellProps, "switcher" | "search" | "tools"> & { collapsed: boolean }) {
  const { isMobile } = useAppShellMobile();
  if (isMobile && !props.search) return null;

  return (
    <StackItem>
      <HStack role="group" aria-label="Workspace tools" gap={4} padding={2} vAlign="center" className="border-b border-border px-4">
        {!isMobile && props.collapsed && (
          <VStack maxWidth={260}>{props.switcher}</VStack>
        )}
        <StackItem size="fill">
          <VStack maxWidth={480}>{props.search}</VStack>
        </StackItem>
        {!isMobile && <StackItem>{props.tools}</StackItem>}
      </HStack>
    </StackItem>
  );
}

/** Next scrolls the window; this shell scrolls its page region. */
function useScrollToTopOnNavigate() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  React.useEffect(() => {
    document.getElementById(SHELL_PAGE_ID)?.scrollTo({ top: 0 });
  }, [pathname, search]);
}

function AccountMenu({ userName, userSubtitle, onSignOut, compact = false }:
  Pick<AppShellProps, "userName" | "userSubtitle" | "onSignOut"> & { compact?: boolean }) {
  const router = useRouter();
  return (
    <DropdownMenu
      hasChevron={false}
      placement="above"
      alignment="start"
      menuWidth={240}
      button={{
        label: `Account menu: ${userName}`,
        children: compact ? undefined : userName,
        "aria-label": `Account menu: ${userName}`,
        variant: "ghost",
        width: compact ? undefined : "100%",
        isIconOnly: compact,
        className: compact ? undefined : "justify-start px-2",
        icon: <Icon icon={CircleUser} size="sm" />,
      }}
      items={[{
        type: "section",
        title: userSubtitle ? `${userName} · ${userSubtitle}` : userName,
        items: [
          { id: "account", label: "Account", icon: CircleUser, onClick: () => router.push("/account") },
          { id: "sign-out", label: "Sign out", icon: LogOut, onClick: onSignOut, isDisabled: !onSignOut },
        ],
      }]}
    />
  );
}
