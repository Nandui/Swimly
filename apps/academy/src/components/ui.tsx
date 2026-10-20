import type { ReactNode } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/shadcn/skeleton";
import { SITE_NAME } from "@/lib/format";
import { AccountLink } from "@/components/account-link";

export { Notice } from "@/components/ui-kit/notice";
export { Tag } from "@/components/ui-kit/tag";

/** The site frame: the site's name and the account link, then the page (its PageShell). `wide`
 *  pages (the course list, a course) use the full 1120px column; forms and bookings keep a 720px
 *  one. `title` names the browser tab. */
export function Frame({ title, children, wide }: { title: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className="frame">
      <title>{`${title} · ${SITE_NAME}`}</title>
      <a href="#main" className="skip-link">Skip to the page</a>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand-name">{SITE_NAME}</Link>
          <nav aria-label="Site" className="topnav">
            <Link href="/" className="topnav-link">Courses</Link>
            <AccountLink />
          </nav>
        </div>
      </header>
      <main id="main" className={`page${wide ? " wide" : ""}`}>{children}</main>
      <footer className="footer">
        <p className="caption">We use your details only to arrange your course and to phone you about payment. Questions about a booking? Reply to any email we sent you.</p>
      </footer>
    </div>
  );
}

/** Placeholder cards the shape of what is coming. */
export function Loading({ rows = 3, grid }: { rows?: number; grid?: boolean }) {
  return (
    <div className={grid ? "course-grid" : "flex flex-col gap-2"} role="status">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className={grid ? "h-60 rounded-panel" : "h-24 rounded-card"} />)}
    </div>
  );
}
