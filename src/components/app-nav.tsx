"use client";

import { signOut } from "next-auth/react";
import { ClubSwitcher } from "@/components/clubs/club-switcher";
import { ThemeFlip } from "@/components/theme-toggle";
import { MobileNav, Sidebar, type AppShellProps } from "@/components/ui-kit/app-shell";
import { visibleNavItems } from "@/lib/nav";
import type { ScreenKey } from "@/lib/staff/screens";

/** The shell's two nav surfaces, bound to this app.
 *
 *  It lives on the client because `Sidebar` holds collapse state and takes an
 *  `onSignOut` callback, neither of which crosses the server boundary. The
 *  layout passes plain strings; the icons come from `@/lib/nav`, which is
 *  imported here rather than handed down, because a component reference is
 *  not serialisable. */
type Club = { id: string; name: string };

type Props = Omit<AppShellProps, "items" | "wordmark" | "onSignOut" | "switcher"> & {
  /** The screens this person can open, already resolved against their role. */
  screens: Set<ScreenKey>;
  club: Club;
  clubs: Club[];
};

const WORDMARK = "Swimly";

function shellProps({ screens, club, clubs, ...rest }: Props): AppShellProps {
  return {
    ...rest,
    wordmark: WORDMARK,
    items: visibleNavItems(screens),
    // Which club every page is showing. Pinned above the nav, and in the bar
    // on a phone, because the mistake it guards against — working in the
    // wrong site without noticing — is one nobody sees coming.
    switcher: (state) => <ClubSwitcher club={club} clubs={clubs} {...state} />,
    // The light/dark flip, one click from anywhere. Handed to the shell as a
    // slot rather than imported by it, so the shell stays ignorant of themes.
    tools: <ThemeFlip />,
    onSignOut: () => void signOut({ redirectTo: "/sign-in" }),
  };
}

export function AppSidebar(props: Props) {
  return <Sidebar {...shellProps(props)} />;
}

export function AppMobileNav(props: Props) {
  return <MobileNav {...shellProps(props)} />;
}
