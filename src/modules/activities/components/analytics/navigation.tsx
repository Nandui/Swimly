import { SegmentedLinks } from "@/components/ui-kit/segmented-links";

const pages = [
  { key: "overview", href: "/analytics", label: "Overview" },
  { key: "reception", href: "/analytics/reception", label: "Reception activity" },
  { key: "instructors", href: "/analytics/instructors", label: "Instructor attendance" },
  { key: "multiple", href: "/analytics/multiple-places", label: "Multiple enrolments" },
] as const;

export function AnalyticsNav({ active }: { active: typeof pages[number]["key"] }) {
  return <SegmentedLinks label="Analytics pages" items={pages.map(({ key, href, label }) => ({ href, label, current: active === key }))} />;
}
