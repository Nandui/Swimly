"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { LogOut, MoreHorizontal, Waves, type LucideIcon } from "lucide-react";
import { AppShell as AstryxAppShell } from "@astryxdesign/core/AppShell";
import { Avatar } from "@astryxdesign/core/Avatar";
import { Badge } from "@astryxdesign/core/Badge";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { NavIcon } from "@astryxdesign/core/NavIcon";
import { SideNav, SideNavHeading, SideNavItem, SideNavSection } from "@astryxdesign/core/SideNav";
import { HStack, StackItem, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { TopNav, TopNavHeading } from "@astryxdesign/core/TopNav";

/** The workspace shell, on Astryx's AppShell: a collapsible side nav that
 *  stays put on desktop, a bar with the same nav in a drawer below `md`, and
 *  the content column. The shell owns the skip link and the main landmark;
 *  pages start at their own H1.
 *
 *  Nav items are passed in rather than declared here, because which sections
 *  exist and who may see them is the app's business, not the shell's. Filter
 *  the array by permission at the layout that renders this. */

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** A count worth interrupting someone for. Renders as a red badge. */
  badge?: number;
};

/** How the switcher is being shown, so it can shrink to fit: to the icon
 *  rail when the desktop sidebar is collapsed, or into the phone bar. */
export type SwitcherState = { collapsed: boolean; compact: boolean };

export type AppShellProps = {
  /** Product name. Rendered as type beside a small mark — no logo asset. */
  wordmark: string;
  /** Where the wordmark goes. Defaults to the root. */
  homeHref?: string;
  items: NavItem[];
  userName: string;
  /** The line under the name: role, team, tenant. */
  userSubtitle?: string;
  onSignOut?: () => void;
  /** Optional control pinned above the nav — a tenant/workspace switcher. A
   *  function is told how it is being shown. On a phone it goes in the bar
   *  beside the wordmark rather than inside the drawer, so it never leaves
   *  the screen. */
  switcher?: React.ReactNode | ((state: SwitcherState) => React.ReactNode);
  /** Small controls that must never be more than one click away — the
   *  light/dark flip. In the side nav's icon row on desktop and at the right
   *  end of the phone bar, reachable without opening the drawer. */
  tools?: React.ReactNode;
  /** A full-width strip above the page — a notice that applies to every
   *  screen, such as a dev build's "seeing the app as" bar. */
  banner?: React.ReactNode;
  children: React.ReactNode;
};

function renderSwitcher(switcher: AppShellProps["switcher"], state: SwitcherState) {
  return typeof switcher === "function" ? switcher(state) : switcher;
}

/** The mark beside the name: a small wave. There is no logo asset, and the
 *  name is a working one, so this is deliberately nothing to remember. */
function Mark() {
  return <Waves className="size-4" aria-hidden />;
}

export function AppShell(props: AppShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);

  const nav = (
    <SideNav
      collapsible={{ isCollapsed: collapsed, onCollapsedChange: setCollapsed }}
      header={
        <SideNavHeading
          icon={<NavIcon icon={<Mark />} />}
          heading={props.wordmark}
          headingHref={props.homeHref ?? "/"}
        />
      }
      topContent={
        props.switcher
          ? renderSwitcher(props.switcher, { collapsed, compact: false })
          : undefined
      }
      footer={<UserRow {...props} collapsed={collapsed} />}
      footerIcons={props.tools}
    >
      <SideNavSection title="Main" isHeaderHidden>
        {props.items.map((item) => {
          // "/" would prefix-match everything, so it alone is matched exactly.
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <SideNavItem
              key={item.href}
              label={item.label}
              href={item.href}
              icon={item.icon}
              isSelected={active}
              endContent={item.badge ? <Badge variant="red" label={item.badge} /> : undefined}
            />
          );
        })}
      </SideNavSection>
    </SideNav>
  );

  // Below the breakpoint the AppShell folds the top nav into a bar: heading,
  // end content, and the drawer toggle. On desktop there is no top bar in
  // this design, so it is hidden from one pixel above Astryx's breakpoint.
  const phoneBar = (
    <TopNav
      label="Page bar"
      className="min-[769px]:hidden"
      heading={<TopNavHeading heading={props.wordmark} headingHref={props.homeHref ?? "/"} />}
      endContent={
        <HStack gap={1} vAlign="center">
          {props.switcher ? renderSwitcher(props.switcher, { collapsed: false, compact: true }) : null}
          {props.tools}
        </HStack>
      }
    />
  );

  return (
    <AstryxAppShell
      height="auto"
      variant="section"
      contentPadding={0}
      banner={props.banner}
      topNav={phoneBar}
      sideNav={nav}
      mobileNav={{ breakpoint: "md" }}
    >
      {/* Centred, 32/40 padding, tighter on phones. */}
      <div className="mx-auto max-w-6xl px-8 py-10 max-md:px-4 max-md:py-6">{props.children}</div>
    </AstryxAppShell>
  );
}

/** Who is signed in, and the way out. Name and role on two lines beside an
 *  initials avatar; the menu behind the dots holds sign-out. In the icon rail
 *  only the avatar remains, and it opens the same menu. */
function UserRow({
  userName,
  userSubtitle,
  onSignOut,
  collapsed,
}: Pick<AppShellProps, "userName" | "userSubtitle" | "onSignOut"> & { collapsed: boolean }) {
  const items = [
    {
      type: "section" as const,
      title: userSubtitle ? `${userName} · ${userSubtitle}` : userName,
      items: [
        {
          id: "sign-out",
          label: "Sign out",
          icon: LogOut,
          onClick: onSignOut,
          isDisabled: !onSignOut,
        },
      ],
    },
  ];

  if (collapsed) {
    return (
      <HStack hAlign="center" paddingBlock={1}>
        <DropdownMenu
          hasChevron={false}
          placement="end"
          button={{
            label: "Account menu",
            isIconOnly: true,
            variant: "ghost",
            size: "sm",
            icon: <Avatar name={userName} size="xsm" />,
          }}
          items={items}
        />
      </HStack>
    );
  }

  return (
    <HStack gap={2} vAlign="center" paddingInline={2} paddingBlock={1}>
      <Avatar name={userName} size="sm" />
      <StackItem size="fill">
        <VStack gap={0}>
          <Text weight="medium" maxLines={1} hasTruncateTooltip={false}>
            {userName}
          </Text>
          {userSubtitle ? (
            <Text type="supporting" maxLines={1} hasTruncateTooltip={false}>
              {userSubtitle}
            </Text>
          ) : null}
        </VStack>
      </StackItem>
      <DropdownMenu
        hasChevron={false}
        placement="above"
        alignment="end"
        button={{
          label: "Account menu",
          isIconOnly: true,
          variant: "ghost",
          size: "sm",
          icon: <MoreHorizontal className="size-4" aria-hidden />,
        }}
        items={items}
      />
    </HStack>
  );
}
