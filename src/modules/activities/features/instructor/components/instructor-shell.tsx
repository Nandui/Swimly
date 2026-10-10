"use client";

import { useEffect, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CircleHelp } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { ClubSwitcher } from "@/components/ui/club-switcher";
import { AccountMenu } from "@/components/ui/account-menu";
import { instructorHomeHref } from "@/modules/activities/shared/attendance/navigation";
import styles from "@/modules/activities/features/instructor/components/instructor-shell.module.css";

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
  const search = params.toString();
  const home = instructorHomeHref({
    tab: params.get("tab") ?? undefined,
    group: params.get("group") ?? undefined,
  });
  // The window scrolls, as in ModuleShell, so a sticky save bar sits on the viewport's edge.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname, search]);

  return (
    <div className={`${styles.workspace} shadcn-workspace tf-shell text-ui-foreground`}>
      <a className="skip-link" href="#instructor-main">Skip to content</a>
      {/* The frame's own inset (24px from 768px, a flat 16px frame on phones), capped as in DeckHome. */}
      <div className="tf-frame" style={{ maxWidth: "var(--pc-deck-width)" }}>
        {banner}
        <header className="tf-top" aria-label="Pool deck tools">
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
            <AccountMenu name={userName} showManageAccount={false} />
          </div>
        </header>
        <main id="instructor-main" tabIndex={-1} className="tf-main">
          <div className="tf-content">{children}</div>
        </main>
      </div>
    </div>
  );
}
