"use client";

import Link from "next/link";
import { Button } from "@/components/shadcn/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/shadcn/dropdown-menu";
import { BookCheck, Check, ChevronDown, ChartNoAxesCombined, ClipboardList, Copy, GraduationCap, Headset, LayoutGrid, Users } from "lucide-react";

/** The analytics suite, grouped by the question a manager brings to it (owner request, 16 October
 *  2026: "a proper business analytics intelligence suite"): how the business is doing, how our people
 *  are doing, and the day-to-day checks. `filtered` pages keep the chosen period, sites and programme. */
export const ANALYTICS_GROUPS = [
  {
    key: "business", label: "The business", pages: [
      { key: "overview", href: "/analytics", label: "Overview", icon: LayoutGrid, filtered: true },
      { key: "classes", href: "/analytics/classes", label: "Classes", icon: ChartNoAxesCombined, filtered: true },
      { key: "swimmers", href: "/analytics/swimmers", label: "Swimmers", icon: Users, filtered: true },
      { key: "progression", href: "/analytics/progression", label: "Progression", icon: GraduationCap, filtered: true },
    ],
  },
  {
    key: "people", label: "Our people", pages: [
      { key: "teachers", href: "/analytics/teachers", label: "Teachers", icon: BookCheck, filtered: true },
      { key: "reception", href: "/analytics/reception", label: "Reception", icon: Headset, filtered: true },
    ],
  },
  {
    key: "checks", label: "Checks", pages: [
      { key: "instructors", href: "/analytics/instructors", label: "Registers", icon: ClipboardList, filtered: false },
      { key: "multiple", href: "/analytics/multiple-places", label: "Multiple enrolments", icon: Copy, filtered: false },
    ],
  },
] as const;

export type AnalyticsPage = typeof ANALYTICS_GROUPS[number]["pages"][number]["key"];

/** The one control for moving around the suite (owner, 19 October 2026: "we have 4 menus within
 *  the same page, this is not right at all"). The app's own bar and rail stay the only menus on the
 *  page; the reports are a single button at the start of the filter bar, named after the report you
 *  are on, opening the reports in their groups and, for the current one, its sections to jump to. */
export function ReportPicker({ active, query = "", sections = [] }: { active: AnalyticsPage; query?: string; sections?: { id: string; label: string }[] }) {
  const current = ANALYTICS_GROUPS.flatMap<{ key: AnalyticsPage; label: string; icon: typeof Check }>(group => [...group.pages]).find(page => page.key === active)!;
  const Icon = current.icon;
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button className="ins-report-button"><Icon aria-hidden="true" strokeWidth={1.75} /><span className="sr-only">Report: </span>{current.label}<ChevronDown aria-hidden="true" strokeWidth={1.75} /></Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" className="ins-report-menu">
      {ANALYTICS_GROUPS.map((group, i) => <DropdownMenuGroup key={group.key}>
        {i ? <DropdownMenuSeparator /> : null}
        <DropdownMenuLabel className="ins-report-label">{group.label}</DropdownMenuLabel>
        {group.pages.map(({ key, href, label, icon: PageIcon, filtered }) => <DropdownMenuItem key={key} asChild className="ins-report-item">
          <Link href={filtered ? `${href}${query}` : href} aria-current={active === key ? "page" : undefined}>
            <PageIcon aria-hidden="true" strokeWidth={1.75} />{label}{active === key ? <Check aria-hidden="true" className="ml-auto" /> : null}
          </Link>
        </DropdownMenuItem>)}
      </DropdownMenuGroup>)}
      {sections.length ? <DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="ins-report-label">On this page</DropdownMenuLabel>
        {sections.map(section => <DropdownMenuItem key={section.id} asChild className="ins-report-item ins-report-section">
          <a href={`#${section.id}`}>{section.label}</a>
        </DropdownMenuItem>)}
      </DropdownMenuGroup> : null}
    </DropdownMenuContent>
  </DropdownMenu>;
}
