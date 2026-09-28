import Link from "next/link";
import { ChartNoAxesCombined, ClipboardCheck, Users } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { cn } from "@/lib/utils";

const pages = [
  { key: "overview", href: "/analytics", label: "Overview", icon: ChartNoAxesCombined },
  { key: "reception", href: "/analytics/reception", label: "Reception activity", icon: Users },
  { key: "instructors", href: "/analytics/instructors", label: "Instructor attendance", icon: ClipboardCheck },
] as const;

export function AnalyticsNav({ active }: { active: typeof pages[number]["key"] }) {
  return <nav aria-label="Analytics pages" className="flex flex-wrap gap-2 border-b border-ui-border pb-4">
    {pages.map(({ key, href, label, icon: Icon }) => <Button asChild variant="ghost" key={key}
      className={cn("min-h-11", active === key && "bg-ui-brand-soft text-ui-brand-ink hover:bg-ui-brand-soft hover:text-ui-brand-ink")}>
      <Link href={href} aria-current={active === key ? "page" : undefined}><Icon aria-hidden="true" />{label}</Link>
    </Button>)}
  </nav>;
}
