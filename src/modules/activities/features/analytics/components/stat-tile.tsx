import type { LucideIcon } from "lucide-react";

/** One figure tile in a `.pc-stats` list (DESIGN.md, "Figure tiles"): the icon,
 *  the figure over its label, then a caption. On the canvas the theme makes it a
 *  borderless white tile; inside a panel it keeps its line. */
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
    <li className="flex min-w-0">
      <div className="pc-stat w-full">
        <span className="pc-tile-icon"><Icon aria-hidden="true" /></span>
        <span>
          <span className="pc-stat-figure block">{value}</span>
          <span className="block font-semibold">{label}</span>
        </span>
        {caption ? <span className="text-xs text-ui-muted-foreground">{caption}</span> : null}
      </div>
    </li>
  );
}
