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

/** The suite's pages in their three groups, the current one raised. */
export function AnalyticsNav({ active, query = "" }: { active: AnalyticsPage; query?: string }) {
  return <nav aria-label="Analytics pages" className="ins-suite">
    {ANALYTICS_GROUPS.map(group => <div key={group.key} className="ins-suite-group" role="group" aria-labelledby={`ins-suite-${group.key}`}>
      <span id={`ins-suite-${group.key}`} className="ins-suite-label">{group.label}</span>
      <ul>{group.pages.map(({ key, href, label, icon: Icon, filtered }) => <li key={key}>
        <Link href={filtered ? `${href}${query}` : href} className="ins-suite-link" aria-current={active === key ? "true" : undefined}>
          <Icon aria-hidden="true" strokeWidth={1.6} />{label}
        </Link>
      </li>)}</ul>
    </div>)}
  </nav>;
}
