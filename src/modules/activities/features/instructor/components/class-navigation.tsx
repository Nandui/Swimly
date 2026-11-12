import { instructorClassHref, instructorClassOverviewHref, type ClassQuery } from "@/modules/activities/shared/attendance/navigation";
import { SegmentedLinks } from "@/components/ui-kit/segmented-links";

export function InstructorClassNavigation({ id, params, active }: {
  id: string;
  params: ClassQuery;
  active: "attendance" | "competencies" | "overview";
}) {
  const links = [
    { key: "attendance", label: "1. Attendance", href: instructorClassHref(id, { ...params, step: "attendance" }) },
    { key: "competencies", label: "2. Competencies", href: instructorClassHref(id, { ...params, step: "competencies" }) },
    { key: "overview", label: "Class overview", href: instructorClassOverviewHref(id, params) },
  ];
  return (
    <SegmentedLinks label="Class steps" items={links.map(link => ({ href: link.href, label: link.label, current: active === link.key }))} />
  );
}
