import Link from "next/link";
import { BookCheck, ChartNoAxesCombined, ClipboardList, Copy, GraduationCap, Headset, LayoutGrid, Users } from "lucide-react";

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

/** The suite's own menu, beside the page on wide screens: the pages in their three groups and,
 *  under the page you are on, its sections. Where you are and where you can go sit in one place,
 *  apart from the filters that change what the page shows. On narrower screens it becomes a row of
 *  tabs across the top and the section links drop away (the page is one column to scroll). */
export function AnalyticsNav({ active, query = "", sections = [] }: { active: AnalyticsPage; query?: string; sections?: { id: string; label: string }[] }) {
  return <nav aria-label="Analytics pages" className="ins-side">
    <p className="ins-side-title">Swim school analytics</p>
    {ANALYTICS_GROUPS.map(group => <div key={group.key} className="ins-side-group" role="group" aria-labelledby={`ins-side-${group.key}`}>
      <span id={`ins-side-${group.key}`} className="ins-side-label">{group.label}</span>
      <ul>{group.pages.map(({ key, href, label, icon: Icon, filtered }) => <li key={key}>
        <Link href={filtered ? `${href}${query}` : href} className="ins-side-link" aria-current={active === key ? "page" : undefined}>
          <Icon aria-hidden="true" strokeWidth={1.75} />{label}
        </Link>
        {active === key && sections.length ? <ul className="ins-side-sections" aria-label="On this page">
          {sections.map(section => <li key={section.id}><a href={`#${section.id}`}>{section.label}</a></li>)}
        </ul> : null}
      </li>)}</ul>
    </div>)}
  </nav>;
}

/** Every analytics page: the suite's menu, then the page itself. */
export function AnalyticsFrame({ active, query, sections, children }: { active: AnalyticsPage; query?: string; sections?: { id: string; label: string }[]; children: React.ReactNode }) {
  return <div className="ins">
    <AnalyticsNav active={active} query={query} sections={sections} />
    <div className="ins-main">{children}</div>
  </div>;
}
