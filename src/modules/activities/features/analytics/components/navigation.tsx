import { SegmentedLinks } from "@/components/ui-kit/segmented-links";

const pages = [
  { key: "overview", href: "/analytics", label: "Overview" },
  { key: "classes", href: "/analytics/classes", label: "Classes" },
  { key: "swimmers", href: "/analytics/swimmers", label: "Swimmers" },
  { key: "progression", href: "/analytics/progression", label: "Progression" },
  { key: "teachers", href: "/analytics/teachers", label: "Teachers" },
  { key: "reception", href: "/analytics/reception", label: "Reception" },
  { key: "instructors", href: "/analytics/instructors", label: "Registers" },
  { key: "multiple", href: "/analytics/multiple-places", label: "Multiple enrolments" },
] as const;

export type AnalyticsPage = typeof pages[number]["key"];

/** The analytics pages. `query` carries the chosen period and sites to the
 *  pages that use them (the first six). */
export function AnalyticsNav({ active, query = "" }: { active: AnalyticsPage; query?: string }) {
  return <SegmentedLinks label="Analytics pages" items={pages.map(({ key, href, label }, i) => ({ href: i < 6 ? `${href}${query}` : href, label, current: active === key }))} />;
}
