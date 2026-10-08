import type { ReactNode } from "react";
import Link from "next/link";
import { CircleAlert, Info, TriangleAlert } from "lucide-react";
import { SITE_NAME, type Meta } from "@/lib/format";

/** The page frame: the site's name on the canvas, then one 720px column. */
export function Frame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="frame">
      <title>{`${title} · ${SITE_NAME}`}</title>
      <header className="topbar"><Link href="/" className="brand-name">{SITE_NAME}</Link></header>
      <main className="page"><div className="stack">{children}</div></main>
      <footer className="footer"><p className="caption">We use your details only to arrange your course and to phone you about payment.</p></footer>
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
export function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="stack-sm" role="status">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }, (_, i) => <div key={i} className="placeholder-row" />)}
    </div>
  );
}
