"use client";

import { useEffect, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { ChevronDown, CircleHelp, LogOut, Monitor, Moon, Sun } from "lucide-react";
import { Avatar, AvatarFallback, initials } from "@/components/shadcn/avatar";
import { useThemeMode } from "@/components/theme-provider";
import { parseThemeMode } from "@/lib/theme-mode";
import { Button } from "@/components/shadcn/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/shadcn/dropdown-menu";
import { ClubSwitcher } from "@/components/clubs/club-switcher";
import { instructorHomeHref } from "@/modules/activities/lib/attendance/navigation";
import { SHELL_PAGE_ID } from "@/lib/shell-preferences";
import styles from "./instructor-shell.module.css";

type Club = { id: string; name: string };

/** The deck has its own frame, without the desk sidebar or desk profile links.
 * Its swimmer lookup covers only the working site and shows medical notes only
 * for swimmers the instructor teaches. Reusing teaching forms does not merge
 * navigation. */
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
  const { mode, setMode } = useThemeMode();
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
      className={`${styles.workspace} shadcn-workspace flex h-dvh flex-col overflow-hidden text-ui-foreground`}
    >
      <a
        href="#instructor-main"
        className="sr-only fixed left-4 top-4 z-50 rounded-ui-md bg-ui-primary p-3 text-ui-primary-foreground focus:not-sr-only"
      >
        Skip to class
      </a>
      {banner}
      <header className={`${styles.topbar} tf-top shrink-0`} aria-label="Pool deck tools">
        <Link href={home} className="tf-brand" aria-label="Pool deck classes">
          <Image src="/brand/turnfin.png" alt="" width={72} height={72} priority />
        </Link>
        <nav className="tf-pages" aria-label="Pool deck">
          <div className="tf-bar">
            <Link href={home} className="tf-bar-item" aria-current={pathname !== "/instructor/swimmers" ? "page" : undefined}>Classes</Link>
            <Link href="/instructor/swimmers" className="tf-bar-item" aria-current={pathname === "/instructor/swimmers" ? "page" : undefined}>Swimmers</Link>
          </div>
        </nav>
        <div className="tf-bar tf-tools" role="group" aria-label="Site, help and account">
          <ClubSwitcher club={club} clubs={clubs} touchTargets />
          <Button asChild variant="ghost" size="icon" className="tf-bar-item tf-icon">
            <Link href="/help/instructor" target="_blank" rel="noopener noreferrer" aria-label="Help (opens in a new tab)"><CircleHelp aria-hidden="true" /></Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="tf-bar-item tf-who" aria-label={`Instructor menu: ${userName}`}>
                <Avatar self aria-hidden="true"><AvatarFallback>{initials(userName)}</AvatarFallback></Avatar><ChevronDown aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 max-w-[calc(100vw-2rem)]">
              <DropdownMenuLabel className="break-words">{userName}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-semibold text-ui-muted-foreground">Appearance</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={mode} onValueChange={(value) => setMode(parseThemeMode(value))}>
                <DropdownMenuRadioItem value="system" className="min-h-11"><Monitor aria-hidden="true" />System</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="light" className="min-h-11"><Sun aria-hidden="true" />Light</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark" className="min-h-11"><Moon aria-hidden="true" />Dark</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="min-h-11" onSelect={() => { void signOut({ callbackUrl: "/sign-in" }); }}>
                <LogOut aria-hidden="true" />Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <main
        id="instructor-main"
        tabIndex={-1}
        className="tf-main flex min-h-0 min-w-0 flex-1 flex-col"
      >
        <div
          id={SHELL_PAGE_ID}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-6 pb-4"
        >
          <div className="mx-auto w-full min-w-0 max-w-6xl">{children}</div>
        </div>
      </main>
    </div>
  );
}
