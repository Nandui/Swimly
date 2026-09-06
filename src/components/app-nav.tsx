"use client";

import { signOut } from "next-auth/react";
import { ClubSwitcher } from "@/components/clubs/club-switcher";
import { ThemeFlip } from "@/components/theme-toggle";
import { AppShell, type AppShellProps } from "@/components/ui-kit/app-shell";
import { visibleNavItems } from "@/lib/nav";
import { APP_NAME } from "@/lib/app";
import type { ScreenKey } from "@/lib/staff/screens";

/** The shell, bound to this app.
 *
 *  It lives on the client because the shell holds collapse state and takes
 *  an `onSignOut` callback, neither of which crosses the server boundary.
 *  The layout passes plain values; the icons come from `@/lib/nav`, which is
 *  imported here rather than handed down, because a component reference is
 *  not serialisable. */
type Club = { id: string; name: string };

type Props = Omit<AppShellProps, "items" | "wordmark" | "onSignOut" | "switcher" | "tools"> & {
  /** The screens this person can open, already resolved against their role. */
  screens: Set<ScreenKey>;
  club: Club;
  clubs: Club[];
};

export function AppChrome({ screens, club, clubs, ...rest }: Props) {
  return (
    <AppShell
      {...rest}
      wordmark={APP_NAME}
      context={club.name}
      items={visibleNavItems(screens)}
      // Which club every page is showing: named under the wordmark, and the
      // switcher beside it, because the mistake it guards against — working
      // in the wrong site without noticing — is one nobody sees coming.
      switcher={<ClubSwitcher club={club} clubs={clubs} />}
      // The light/dark flip, one tap from anywhere. Handed to the shell as a
      // slot rather than imported by it, so the shell stays ignorant of themes.
      tools={<ThemeFlip />}
      onSignOut={() => void signOut({ redirectTo: "/sign-in" })}
    />
  );
}
