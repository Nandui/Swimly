"use client";

import { signOut } from "next-auth/react";
import { MobileNav, Sidebar, type AppShellProps } from "@/components/ui-kit/app-shell";
import { visibleNavItems } from "@/lib/nav";
import type { PermissionKey } from "@/lib/staff/permissions";

/** The shell's two nav surfaces, bound to this app.
 *
 *  It lives on the client because `Sidebar` holds collapse state and takes an
 *  `onSignOut` callback, neither of which crosses the server boundary. The
 *  layout passes plain strings; the icons come from `@/lib/nav`, which is
 *  imported here rather than handed down, because a component reference is
 *  not serialisable. */
type Props = Omit<AppShellProps, "items" | "wordmark" | "onSignOut"> & {
  permissions: Set<PermissionKey>;
};

const WORDMARK = "Swimly";

function shellProps({ permissions, ...rest }: Props): AppShellProps {
  return {
    ...rest,
    wordmark: WORDMARK,
    items: visibleNavItems(permissions),
    onSignOut: () => void signOut({ redirectTo: "/sign-in" }),
  };
}

export function AppSidebar(props: Props) {
  return <Sidebar {...shellProps(props)} />;
}

export function AppMobileNav(props: Props) {
  return <MobileNav {...shellProps(props)} />;
}
