import type { LucideIcon } from "lucide-react";

/** One figure cell in an `.ins-kpis` strip, for the suite's client-side check pages (Registers and
 *  Multiple enrolments): the icon and label, the figure, then a caption. */
export function StatTile({
  icon: Icon,
  value,
  label,
  caption,
}: {
  icon: LucideIcon;
  value: React.ReactNode;
  label: string;
  caption?: React.ReactNode;
}) {
  return (
    <li className="ins-kpi-cell">
      <div className="ins-kpi">
        <span className="ins-kpi-label">{label}<Icon aria-hidden="true" className="ins-kpi-go" /></span>
        <span className="ins-kpi-line"><span className="ins-kpi-value">{value}</span></span>
        {caption ? <span className="ins-kpi-note">{caption}</span> : null}
      </div>
    </li>
  );
}
