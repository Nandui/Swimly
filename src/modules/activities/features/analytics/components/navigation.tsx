import Link from "next/link";
import { Headset, TrendingUp, Waves } from "lucide-react";

/** Swim school analytics as three dashboards, one for each person who reads them (owner, 19 October
 *  2026: "analytics for the business decisions, another for the reception so the supervisor can
 *  performance manage the people managing it, and another for the pool deck supervisor so they can
 *  manage their teachers, and service delivery like attendance, competencies and all that"). */
const DASHBOARDS = [
  { key: "business", href: "/analytics", label: "Business", icon: TrendingUp },
  { key: "reception", href: "/analytics/reception", label: "Reception", icon: Headset },
  { key: "pool-deck", href: "/analytics/pool-deck", label: "Pool deck", icon: Waves },
] as const;

type Dashboard = typeof DASHBOARDS[number]["key"];

/** Every analytics page and the dashboard it opens from. The pages behind a dashboard are its
 *  detail: reached from its panels, with a way back to it. */
const ANALYTICS_PAGES = {
  business: "business", classes: "business", swimmers: "business", multiple: "business",
  reception: "reception",
  "pool-deck": "pool-deck", teachers: "pool-deck", progression: "pool-deck", instructors: "pool-deck",
} as const satisfies Record<string, Dashboard>;

export type AnalyticsPage = keyof typeof ANALYTICS_PAGES;

export function dashboardOf(page: AnalyticsPage) {
  return DASHBOARDS.find(d => d.key === ANALYTICS_PAGES[page])!;
}

/** The one way between the dashboards: three choices at the start of the page's bar, the app's own
 *  bar and rail staying the only menus. `query` keeps the chosen period, sites and programme. */
export function DashboardSwitch({ page, query = "" }: { page: AnalyticsPage; query?: string }) {
  const active = ANALYTICS_PAGES[page];
  return <nav aria-label="Dashboards" className="pc-seg ins-switch">
    {DASHBOARDS.map(({ key, href, label, icon: Icon }) => <Link key={key} href={`${href}${query}`} className="pc-seg-item ins-switch-item" aria-current={active === key ? (page === key ? "page" : "true") : undefined}>
      <Icon aria-hidden="true" strokeWidth={1.75} />{label}
    </Link>)}
  </nav>;
}
