import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { SiteSettings } from "@/components/tasks/site-settings";
import { formatDate, parseDateOnly } from "@/lib/format";
import { taskSites } from "@/lib/tasks/data";
import { SITE_STATUS_META, dayIn } from "@/lib/tasks/rules";

export const metadata: Metadata = { title: "Sites" };

/** Each site's Tasks settings (the prototype's Sites page): whether it is live, its area and
 *  time zone, business hours, how many published templates apply there and its closed dates.
 *  Managers change them. */
export default async function TaskSitesPage() {
  const { who, sites } = await taskSites();
  return (
    <>
      <PageHeader title="Your sites" description="Working hours and closed dates for each location. Schedules can start at opening or be due at closing; no tasks are made on a closed date or at a site that is not live." />
      <div className="pc-grid">
        {sites.map((s) => {
          const ahead = s.closedDates.filter((d) => d >= dayIn(s.timezone));
          return (
            <section key={s.id} className="pc-panel" aria-labelledby={`site-${s.id}`}>
              <div className="pc-panel-head">
                <div className="flex items-center gap-3">
                  <span className="pc-tile-icon" aria-hidden="true"><Building2 /></span>
                  <div className="flex flex-col gap-1"><h2 id={`site-${s.id}`}>{s.name}</h2><p className="pc-row-hint">{[s.area, s.timezone].filter(Boolean).join(" · ")}</p></div>
                </div>
                <Tag meta={SITE_STATUS_META[s.status]} />
              </div>
              <dl className="flex flex-col">
                {[["Business hours", `${s.opening} to ${s.closing}`], ["Published templates", String(s.templates)], ["Closed dates ahead", String(ahead.length)]].map(([k, v]) => (
                  <div key={k} className="flex min-h-11 items-center justify-between gap-2 border-b border-[var(--pc-line)] last:border-b-0">
                    <dt className="text-sm text-ui-muted-foreground">{k}</dt><dd className="font-semibold tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
              {ahead.length ? <p className="text-xs text-ui-muted-foreground">Closed {ahead.slice(0, 6).map((d) => formatDate(parseDateOnly(d))).join(", ")}{ahead.length > 6 ? ` and ${ahead.length - 6} more` : ""}.</p> : null}
              {who.manage ? <div><SiteSettings site={{ ...s, siteId: s.id }} label="Manage site" /></div> : null}
            </section>
          );
        })}
      </div>
    </>
  );
}
