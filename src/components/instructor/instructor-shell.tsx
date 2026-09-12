"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { ArrowLeft, LogOut, UserRound, Waves } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/shadcn/dropdown-menu";
import { ClubSwitcher } from "@/components/clubs/club-switcher";
import { ThemeFlip } from "@/components/theme-toggle";
import { instructorHomeHref } from "@/lib/attendance/navigation";
import { SHELL_PAGE_ID } from "@/lib/shell-preferences";
import styles from "./instructor-shell.module.css";

type Club = { id: string; name: string };

/** The deck has its own frame, without the desk sidebar, global swimmer
 * search or profile links. Reusing teaching forms does not merge navigation. */
export function InstructorShell({
  children,
  userName,
  club,
  clubs,
  banner,
}: {
  children: ReactNode;
  userName: string;
  club: Club;
  clubs: Club[];
  banner?: ReactNode;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const search = params.toString();
  const home = instructorHomeHref({
    tab: params.get("tab") ?? undefined,
    group: params.get("group") ?? undefined,
  });
  useEffect(() => {
    document.getElementById(SHELL_PAGE_ID)?.scrollTo({ top: 0 });
  }, [pathname, search]);

  return (
    <div
      className={`${styles.workspace} shadcn-workspace flex h-dvh flex-col overflow-hidden bg-ui-background text-ui-foreground`}
    >
      <a
        href="#instructor-main"
        className="sr-only fixed left-4 top-4 z-50 rounded-ui-md bg-ui-primary p-3 text-ui-primary-foreground focus:not-sr-only"
      >
        Skip to class
      </a>
      {banner}
      <header
        className="shrink-0 border-b border-ui-border bg-ui-background px-4 py-3"
        aria-label="Pool deck tools"
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
          <Button
            asChild
            variant="ghost"
            className="min-h-11 shrink-0 px-2 text-base font-semibold"
          >
            <Link href={home}>
              {pathname === "/instructor" ? (
                <Waves aria-hidden="true" />
              ) : (
                <ArrowLeft aria-hidden="true" />
              )}
              <span>
                {pathname === "/instructor" ? "Pool deck" : "Classes"}
              </span>
            </Link>
          </Button>
          <div className="order-last w-full min-w-0 sm:order-none sm:w-60">
            <ClubSwitcher club={club} clubs={clubs} touchTargets />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeFlip />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="min-h-11 min-w-11"
                  aria-label={`Instructor menu: ${userName}`}
                >
                  <UserRound aria-hidden="true" />
                  <span className="hidden max-w-48 truncate md:inline">
                    {userName}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-w-72">
                <DropdownMenuLabel className="break-words">
                  {userName}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="min-h-11"
                  onSelect={() => {
                    void signOut({ callbackUrl: "/sign-in" });
                  }}
                >
                  <LogOut aria-hidden="true" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <main
        id="instructor-main"
        tabIndex={-1}
        className="flex min-h-0 min-w-0 flex-1 flex-col"
      >
        <div
          id={SHELL_PAGE_ID}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4"
        >
          <div className="mx-auto w-full min-w-0 max-w-6xl">{children}</div>
        </div>
      </main>
    </div>
  );
}
