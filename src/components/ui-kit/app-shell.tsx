"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CircleUser, LogOut, Waves, type LucideIcon } from "lucide-react";
import { AppShell as AstryxAppShell } from "@astryxdesign/core/AppShell";
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
import { HStack, VStack } from "@astryxdesign/core/Stack";
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
  // The account menu uses the name row when expanded and a footer icon
  // when collapsed, so it remains reachable in the rail.
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
          aria-label="Main navigation"
          collapsible={{
            isCollapsed: collapsed,
            onCollapsedChange: setCollapsed,
          }}
          footer={collapsed ? undefined : <AccountMenu {...props} />}
          footerIcons={collapsed ? <AccountMenu {...props} compact /> : undefined}
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

/** Personal navigation and sign-out share a popover anchored to the name. */
function AccountMenu({
  userName,
  userSubtitle,
  onSignOut,
  compact = false,
}: Pick<AppShellProps, "userName" | "userSubtitle" | "onSignOut"> & { compact?: boolean }) {
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
      items={[
        {
          type: "section",
          title: userSubtitle ? `${userName} · ${userSubtitle}` : userName,
          items: [
            { id: "account", label: "Account", icon: CircleUser, onClick: () => router.push("/account") },
            { id: "sign-out", label: "Sign out", icon: LogOut, onClick: onSignOut, isDisabled: !onSignOut },
          ],
        },
      ]}
    />
  );
}
