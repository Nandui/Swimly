import Link from "next/link";
import type { LucideIcon } from "lucide-react";

/** Figure tiles (DESIGN.md, Components: Figure): a row of big tabular numbers, each with its
 *  label and symbol above and a one-line hint below. On the ground each tile is a bg-2 card; a
 *  tile that filters the page is a link and shows `current` when it is the open filter. Nothing
 *  here knows what is counted. */
export function Figures({ label, compact = false, children }: { label: string; compact?: boolean; children: React.ReactNode }) {
  return <ul className="pc-stats" data-compact={compact ? "" : undefined} aria-label={label}>{children}</ul>;
}

/** One tile. A zero (or `quiet`) figure is grey; `tone` orange marks a hint that needs action. */
export function Figure({ icon: Icon, label, value, hint, tone, href, current = false, quiet }: {
  icon?: LucideIcon; label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "orange"; href?: string; current?: boolean; quiet?: boolean;
}) {
  const body = (
    <>
      <span className="pc-stat-label">{Icon ? <Icon aria-hidden="true" /> : null}{label}</span>
      <span className="pc-stat-figure" data-zero={(quiet ?? value === 0) ? "" : undefined}>{value}</span>
      {hint ? <span className="pc-stat-hint" data-tone={tone}>{hint}</span> : null}
    </>
  );
  return (
    <li className="flex">
      {href ? <Link href={href} className="pc-stat w-full" aria-current={current ? "true" : undefined}>{body}</Link> : <div className="pc-stat w-full">{body}</div>}
    </li>
  );
}
