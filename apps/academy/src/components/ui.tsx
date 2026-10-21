import type { ReactNode } from "react";
import { Waves } from "lucide-react";
import { Skeleton } from "@/components/shadcn/skeleton";
import { SITE_NAME } from "@/lib/format";
import { Brand, SiteNav, ThemeButton } from "@/components/site-frame";

export { Notice } from "@/components/ui-kit/notice";
export { Tag } from "@/components/ui-kit/tag";

/** The site frame, as on the parents app: the navy header (logo, Courses, the account link and the
 *  appearance switch), then the page (its PageShell), then the footer. `wide` pages (the course
 *  list, a course) use the full 1176px column; forms and bookings a 760px one. `title` names the
 *  browser tab. */
export function Frame({ title, children, wide }: { title: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className="frame">
      <title>{`${title} · ${SITE_NAME}`}</title>
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="site-header">
        <div className="site-header-inner">
          <Brand />
          <div className="site-header-end">
            <SiteNav />
            <ThemeButton />
          </div>
        </div>
      </header>
      <main id="main" className={`page${wide ? " wide" : ""}`}>{children}</main>
      <footer className="site-footer">
        <div className="site-footer-inner">
          <p className="site-footer-name">{SITE_NAME}</p>
          <a href="mailto:info@leisureworldcork.com" className="site-footer-link">Need a hand? Contact the team</a>
        </div>
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
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className={grid ? "h-48 rounded-panel" : "h-24 rounded-card"} />)}
    </div>
  );
}

/** Nothing to show yet, as on the parents app: a soft blue card with a wave, a line, and where to
 *  go next. */
export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="empty-state" aria-label={title}>
      <Waves className="empty-state-icon" aria-hidden="true" />
      <h2>{title}</h2>
      <p className="text-ui-muted-foreground">{children}</p>
      {action}
    </section>
  );
}
