import Link from "next/link";
import { Button } from "@/components/shadcn/button";
import { instructorClassHref, instructorClassOverviewHref, type ClassQuery } from "@/lib/attendance/navigation";

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
    <nav aria-label="Class steps" className="flex flex-wrap gap-2 border-b border-ui-border pb-3">
      {links.map(link => (
        <Button key={link.key} asChild variant={active === link.key ? "secondary" : "ghost"} className="min-h-11">
          <Link href={link.href} aria-current={active === link.key ? "page" : undefined}>{link.label}</Link>
        </Button>
      ))}
    </nav>
  );
}
