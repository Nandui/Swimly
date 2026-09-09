"use client";

import { Badge } from "@/components/workspace/feedback";
import { Tab, TabList } from "@/components/workspace/choices";



export type TabStripItem = {
  key: string;
  href: string;
  label: string;
  /** A count worth showing beside the label — how many classes, how many
   *  registers. Leave it out for a section that is not a list. */
  count?: number | null;
  active: boolean;
};

export function TabStrip({
  ariaLabel,
  items,
  countsOnPhone = false,
}: {
  ariaLabel: string;
  items: TabStripItem[];
  /** Keep the counts at phone width. Off by default so four tabs still fit
   *  at 375px; on for a two-tab strip whose counts are the point. */
  countsOnPhone?: boolean;
}) {
  const active = items.find((item) => item.active)?.key ?? items[0]?.key ?? "";

  return (
    <TabList value={active} onChange={() => {}} hasDivider aria-label={ariaLabel}>
      {items.map((item) => (
        <Tab
          key={item.key}
          value={item.key}
          label={item.label}
          href={item.href}
          endContent={
            item.count !== undefined && item.count !== null ? (
              <Badge variant="neutral" label={item.count} className={countsOnPhone ? undefined : "max-sm:hidden"} />
            ) : undefined
          }
        />
      ))}
    </TabList>
  );
}
