import { CalendarDays, Settings2 } from "lucide-react";
import { SegmentedLinks } from "@/components/ui-kit/segmented-links";

export type AssessmentSection = "upcoming" | "setup";

export function AssessmentNav({ active, manage }: { active: AssessmentSection; manage: boolean }) {
  const pages = [
    { key: "upcoming", href: "/assessments", label: "Upcoming assessments", icon: CalendarDays },
    ...(manage ? [{ key: "setup", href: "/assessments/setup", label: "Assessment setup", icon: Settings2 }] : []),
  ];
  return <SegmentedLinks label="Assessment pages" items={pages.map(({ key, href, label, icon: Icon }) => ({ href, label: <><Icon aria-hidden="true" className="size-4" />{label}</>, current: active === key }))} />;
}
