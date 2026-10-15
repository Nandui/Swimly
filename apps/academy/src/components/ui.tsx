import type { ReactNode } from "react";
import Link from "next/link";
import { CircleAlert, Info, TriangleAlert } from "lucide-react";
import { SITE_NAME, type Meta } from "@/lib/format";
import { AccountLink } from "@/components/account-link";

/** The page frame: the site's name and the account link, then the page. `wide` pages (the course
 *  list, a course) use the full 1120px column; forms and bookings keep a 720px one. */
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
      <main id="main" className={`page${wide ? " wide" : ""}`}><div className="stack">{children}</div></main>
      <footer className="footer">
        <p className="caption">We use your details only to arrange your course and to phone you about payment. Questions about a booking? Reply to any email we sent you.</p>
      </footer>
    </div>
  );
}

export function Tag({ meta }: { meta: Meta }) {
  const Icon = meta.icon;
  return <span className={`tag tone-${meta.tone}`}><Icon aria-hidden="true" />{meta.label}</span>;
}

const NOTICE_ICON = { info: Info, warning: TriangleAlert, error: CircleAlert };

/** A callout with an icon per tone. `live` announces it: only for the result of something the
 *  person just did, never for what a page says on load. */
export function Notice({ title, children, tone, live }: { title: string; children?: ReactNode; tone?: "error" | "warning"; live?: boolean }) {
  const Icon = NOTICE_ICON[tone ?? "info"];
  return (
    <div className={`notice${tone ? ` ${tone}` : ""}`} role={live ? (tone === "error" ? "alert" : "status") : undefined}>
      <Icon aria-hidden="true" />
      <div className="notice-body"><strong>{title}</strong>{children ? <p>{children}</p> : null}</div>
    </div>
  );
}

/** Placeholder cards the shape of what is coming. */
export function Loading({ rows = 3, grid }: { rows?: number; grid?: boolean }) {
  return (
    <div className={grid ? "course-grid" : "stack-sm"} role="status">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }, (_, i) => <div key={i} className={grid ? "placeholder-card" : "placeholder-row"} />)}
    </div>
  );
}
