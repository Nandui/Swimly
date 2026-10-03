import { ChartNoAxesCombined, ClipboardCheck, Users } from "lucide-react";
import { SegmentedLinks } from "@/components/ui-kit/segmented-links";

const pages = [
  { key: "overview", href: "/analytics", label: "Overview", icon: ChartNoAxesCombined },
  { key: "reception", href: "/analytics/reception", label: "Reception activity", icon: Users },
  { key: "instructors", href: "/analytics/instructors", label: "Instructor attendance", icon: ClipboardCheck },
] as const;

export function AnalyticsNav({ active }: { active: typeof pages[number]["key"] }) {
  return <SegmentedLinks label="Analytics pages" items={pages.map(({ key, href, label, icon: Icon }) => ({ href, label: <><Icon aria-hidden="true" className="size-4" />{label}</>, current: active === key }))} />;
}
