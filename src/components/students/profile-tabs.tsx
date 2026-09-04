import Link from "next/link";
import { cn } from "@/lib/utils";

/** The sections of a swimmer's profile, one on screen at a time.
 *
 *  Links rather than a client-side tab widget, on purpose: the tab is in the
 *  URL, so a bookmark or a message can point at "their attendance", the back
 *  button works, and each section is rendered by the server with only what
 *  it needs. `scroll={false}` keeps the page where it is when switching, so
 *  the strip does not jump away from under the pointer. */

export const PROFILE_TABS = ["classes", "progress", "attendance", "assessments"] as const;

export type ProfileTab = (typeof PROFILE_TABS)[number];

export function profileTab(value: string | string[] | undefined): ProfileTab {
  const wanted = Array.isArray(value) ? value[0] : value;
  return (PROFILE_TABS as readonly string[]).includes(wanted ?? "")
    ? (wanted as ProfileTab)
    : "classes";
}

export type ProfileTabItem = {
  key: ProfileTab;
  label: string;
  /** A count worth showing beside the label — how many classes, how many
   *  registers. Null for a section that is not a list. */
  count: number | null;
};

export function ProfileTabs({
  studentId,
  active,
  items,
}: {
  studentId: string;
  active: ProfileTab;
  items: ProfileTabItem[];
}) {
  return (
    // The hairline under the strip is an inset shadow rather than a border,
    // so the active tab's 2px edge can sit on it without a negative margin —
    // which, inside a scroll container, grows a scrollbar of its own.
    <nav aria-label="Sections of this profile" className="overflow-x-auto">
      <ul className="flex gap-0 shadow-[inset_0_-1px_0_0_var(--border)] sm:gap-1">
        {items.map((item) => {
          const current = item.key === active;
          return (
            <li key={item.key} className="shrink-0">
              <Link
                href={`/students/${studentId}?tab=${item.key}`}
                scroll={false}
                aria-current={current ? "page" : undefined}
                className={cn(
                  // Tighter on a phone, and without the count, so all four
                  // fit at 375px instead of the last one scrolling out of view.
                  "flex items-center gap-1.5 border-b-2 px-2 py-2 text-[13.5px] font-medium transition-colors sm:px-3",
                  "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  current
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                )}
              >
                {item.label}
                {item.count !== null ? (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[11px] leading-4 tabular-nums max-sm:hidden",
                      current ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {item.count}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
