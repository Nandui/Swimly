import Link from "next/link";
import { cn } from "@/lib/utils";

/** A row of sections, one on screen at a time, each a link.
 *
 *  Links rather than a client-side tab widget, on purpose: the tab is in the
 *  URL, so a bookmark or a message can point at one section, the back button
 *  works, and each section is rendered by the server with only what it
 *  needs. `scroll={false}` keeps the page where it is when switching. */

export type TabStripItem = {
  key: string;
  href: string;
  label: string;
  /** A count worth showing beside the label — how many classes, how many
   *  registers. Leave it out for a section that is not a list. */
  count?: number | null;
  active: boolean;
};

export function TabStrip({ ariaLabel, items }: { ariaLabel: string; items: TabStripItem[] }) {
  return (
    // The hairline under the strip is an inset shadow rather than a border,
    // so the active tab's 2px edge can sit on it without a negative margin —
    // which, inside a scroll container, grows a scrollbar of its own.
    <nav aria-label={ariaLabel} className="overflow-x-auto">
      <ul className="flex gap-0 shadow-[inset_0_-1px_0_0_var(--border)] sm:gap-1">
        {items.map((item) => (
          <li key={item.key} className="shrink-0">
            <Link
              href={item.href}
              scroll={false}
              aria-current={item.active ? "page" : undefined}
              className={cn(
                // Tighter on a phone, and without the count, so four fit at
                // 375px instead of the last one scrolling out of view.
                "flex items-center gap-1.5 border-b-2 px-2 py-2 text-[13.5px] font-medium transition-colors sm:px-3",
                "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                item.active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
              )}
            >
              {item.label}
              {item.count !== undefined && item.count !== null ? (
                <span
                  className={cn(
                    // Foreground ink on both tints: primary-blue ink on the
                    // blue tint measured 4.3:1 in light mode, under the bar.
                    "rounded-full px-1.5 text-[11px] leading-4 tabular-nums max-sm:hidden",
                    item.active ? "bg-primary/15 text-foreground" : "bg-muted text-muted-foreground"
                  )}
                >
                  {item.count}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
