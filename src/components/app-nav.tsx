"use client";

import { signOut } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { ClubSwitcher } from "@/components/clubs/club-switcher";
import { ThemeFlip } from "@/components/theme-toggle";
import { AppShell, type AppShellProps } from "@/components/ui-kit/app-shell";
import { WorkspaceSearch } from "@/components/students/workspace-search";
import { pageWidthFor, swimmerLookupHref, visibleNavGroups } from "@/lib/nav";
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

type Props = Omit<AppShellProps, "groups" | "wordmark" | "onSignOut" | "switcher" | "tools" | "search" | "contentMaxWidth"> & {
  /** The screens this person can open, already resolved against their role. */
  screens: Set<ScreenKey>;
  club: Club;
  clubs: Club[];
};

export function AppChrome({ screens, club, clubs, ...rest }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const canFindSwimmer = screens.has("students");

  return (
    <AppShell
      {...rest}
      wordmark={APP_NAME}
      groups={visibleNavGroups(screens)}
      contentMaxWidth={pageWidthFor(pathname)}
      switcher={<ClubSwitcher club={club} clubs={clubs} />}
      search={canFindSwimmer && pathname !== "/students" ? (
        <WorkspaceSearch
          key={`${club.id}:${pathname}`}
          onSelect={hit => {
            if (!hit) return;
            const href = swimmerLookupHref(screens, hit.id);
            if (href) router.push(href);
          }}
        />
      ) : undefined}
      // The light/dark flip, one tap from anywhere. Handed to the shell as a
      // slot rather than imported by it, so the shell stays ignorant of themes.
      tools={<ThemeFlip />}
      onSignOut={() => void signOut({ redirectTo: "/sign-in" })}
    />
  );
}
