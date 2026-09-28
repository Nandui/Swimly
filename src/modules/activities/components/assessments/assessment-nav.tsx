import Link from "next/link";
import { CalendarDays, Settings2 } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { cn } from "@/lib/utils";

export type AssessmentSection = "upcoming" | "setup";

export function AssessmentNav({ active, manage }: { active: AssessmentSection; manage: boolean }) {
  const pages = [
    { key: "upcoming", href: "/assessments", label: "Upcoming assessments", icon: CalendarDays },
    ...(manage ? [{ key: "setup", href: "/assessments/setup", label: "Assessment setup", icon: Settings2 }] : []),
  ];
  return <nav aria-label="Assessment pages" className="flex flex-wrap gap-2 border-b border-ui-border pb-4">
    {pages.map(({ key, href, label, icon: Icon }) => <Button asChild variant="ghost" key={key}
      className={cn("min-h-11", active === key && "bg-ui-brand-soft text-ui-brand-ink hover:bg-ui-brand-soft hover:text-ui-brand-ink")}>
      <Link href={href} aria-current={active === key ? "page" : undefined}><Icon aria-hidden="true" />{label}</Link>
    </Button>)}
  </nav>;
}
