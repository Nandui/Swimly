"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { LogOut, MoreHorizontal, Waves, type LucideIcon } from "lucide-react";
import { AppShell as AstryxAppShell } from "@astryxdesign/core/AppShell";
import { Avatar } from "@astryxdesign/core/Avatar";
import { Badge } from "@astryxdesign/core/Badge";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { Icon } from "@astryxdesign/core/Icon";
import { Center } from "@astryxdesign/core/Center";
import { NavIcon } from "@astryxdesign/core/NavIcon";
import {
  SideNav,
  SideNavItem,
  SideNavSection,
} from "@astryxdesign/core/SideNav";
import { HStack, StackItem, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { TopNav, TopNavHeading } from "@astryxdesign/core/TopNav";

/** The workspace shell, on Astryx's AppShell in its most common shape: a
 *  TopNav carrying the app's identity and the concerns that span the whole
 *  app — which club is being worked in, the colour mode — and a SideNav
 *  carrying the screens. Below `md` the AppShell folds the SideNav into a
 *  drawer and the TopNav into a bar with the toggle, so the club switcher
 *  never leaves the screen. The shell owns the skip link and the main
 *  landmark; pages start at their own H1.
 *
 *  Responsive contract:
 *    any    the shell fills the viewport; the page scrolls in the main region
 *    >768   TopNav | SideNav 256, collapsible to a rail | content capped at 1152
 *    <=768  TopNav as a bar, switcher icon-only; SideNav in the drawer (mobileNav "md")
 *    any    16px of content padding from the shell; touch targets grow to 44px
 *           below the tablet breakpoint and on coarse pointers (globals.css)
 *
 *  Nav items are passed in rather than declared here, because which sections
 *  exist and who may see them is the app's business, not the shell's. */

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** A count worth interrupting someone for. Renders as a red badge. */
  badge?: number;
};

export type AppShellProps = {
  /** Product name. Rendered as type beside a small mark — no logo asset. */
  wordmark: string;
  /** Where the wordmark goes. Defaults to the root. */
  homeHref?: string;
  /** What the app is showing right now — the tenant — as the heading's
   *  subheading, Astryx's slot for "account context". It reads on every
   *  device, however the switcher beside it is drawn. */
  context?: string;
  items: NavItem[];
  userName: string;
  /** The line under the name: role, team, tenant. */
  userSubtitle?: string;
  onSignOut?: () => void;
  /** The tenant/workspace switcher, in the TopNav on every device. */
  switcher?: React.ReactNode;
  /** Small controls that must never be more than one tap away — the
   *  light/dark flip. At the end of the TopNav. */
  tools?: React.ReactNode;
  /** A full-width strip above the page — a notice that applies to every
   *  screen, such as a dev build's "seeing the app as" bar. */
  banner?: React.ReactNode;
  children: React.ReactNode;
};

export function AppShell(props: AppShellProps) {
  const pathname = usePathname();
  // The rail: Astryx collapses its items to icons by itself, but the account
  // row is ours, so the shell holds the state and hides the row when the
  // nav is a rail. The account menu lives in the footer icon bar, which
  // Astryx keeps in both states beside its own collapse button.
  const [collapsed, setCollapsed] = React.useState(false);
  useScrollToTopOnNavigate();

  return (
    <AstryxAppShell
      // Astryx's defaults, on purpose: the shell fills the viewport and the
      // page scrolls inside its own region, so the nav and the raised content
      // card stay where they are and only the page moves. (In height="auto"
      // the whole document scrolled, the card's rounded corner scrolled away
      // with it, and the "section" variant left the sticky header unpainted.)
      height="fill"
      variant="elevated"
      banner={props.banner}
      contentPadding={4}
      mobileNav={{ breakpoint: "md" }}
      topNav={
        <TopNav
          label="Top navigation"
          heading={
            <TopNavHeading
              heading={props.wordmark}
              headingHref={props.homeHref ?? "/"}
              subheading={props.context}
              logo={<NavIcon icon={<Icon icon={Waves} size="sm" />} />}
            />
          }
          endContent={
            <HStack gap={2} vAlign="center">
              {props.switcher}
              {props.tools}
            </HStack>
          }
        />
      }
      sideNav={
        <SideNav
          collapsible={{
            isCollapsed: collapsed,
            onCollapsedChange: setCollapsed,
          }}
          footer={collapsed ? undefined : <UserRow {...props} />}
          footerIcons={<AccountMenu {...props} />}
        >
          <SideNavSection title="Screens" isHeaderHidden>
            {props.items.map((item) => {
              // "/" would prefix-match everything, so it alone is matched exactly.
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <SideNavItem
                  key={item.href}
                  label={item.label}
                  href={item.href}
                  icon={item.icon}
                  isSelected={active}
                  endContent={
                    item.badge ? (
                      <Badge variant="red" label={item.badge} />
                    ) : undefined
                  }
                />
              );
            })}
          </SideNavSection>
        </SideNav>
      }
    >
      {/* Prose, forms and lists cap at a readable width; tables fill it. */}
      {/* The shell already is the page's Layout — Astryx says one per shell,
          never nested — so the page is capped and centred with Center and a
          stack rather than a second Layout. */}
      <Center axis="horizontal">
        {/* Astryx's tables, dividers and sections bleed to the nearest
            container's padding edge — the shell's, 16px outside this column —
            so a table ran wider than the cards beside it. The column zeroes
            the two container-padding variables that bleed reads, which is
            the same thing a padded Card or Section does for its own
            children: it says "the edge is here". */}
        <VStack
          width="100%"
          maxWidth={1152}
          className="[--container-padding-inline-start:0px] [--container-padding-inline-end:0px]"
        >
          {props.children}
        </VStack>
      </Center>
    </AstryxAppShell>
  );
}

/** The page scrolls inside the shell's main region, not the window, so the
 *  browser's own scroll-to-top on navigation never fires. This does what the
 *  browser would have: every new URL starts at the top. */
function useScrollToTopOnNavigate() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  React.useEffect(() => {
    document.getElementById("astryx-app-shell-main")?.scrollTo({ top: 0 });
  }, [pathname, search]);
}

/** Who is signed in. Name and role on two lines beside an initials avatar;
 *  shown only while the nav is wide enough to hold two lines of text. */
function UserRow({
  userName,
  userSubtitle,
}: Pick<AppShellProps, "userName" | "userSubtitle">) {
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
    </HStack>
  );
}

/** The way out. An icon-only menu in the SideNav's footer icon bar, so it is
 *  there whether the nav is wide or a rail. */
function AccountMenu({
  userName,
  userSubtitle,
  onSignOut,
}: Pick<AppShellProps, "userName" | "userSubtitle" | "onSignOut">) {
  return (
    <DropdownMenu
      hasChevron={false}
      placement="above"
      alignment="start"
      button={{
        label: `Account menu: ${userName}`,
        isIconOnly: true,
        variant: "ghost",
        icon: <Icon icon={MoreHorizontal} size="sm" />,
      }}
      items={[
        {
          type: "section",
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
      ]}
    />
  );
}
