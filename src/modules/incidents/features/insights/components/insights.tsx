import Link from "next/link";
import { Progress } from "@/components/shadcn/progress";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { SegmentedLinks } from "@/components/ui-kit/segmented-links";
import { formatDate } from "@/lib/format";
import type { IncidentInsights } from "@/modules/incidents/features/insights/server/data";
import { PERIODS } from "@/modules/incidents/features/insights/server/data";
import type { Count } from "@/modules/incidents/shared/rules";
import { incidentCategories, incidentKinds, incidentNumber, severities, type IncidentCategory, type IncidentKind, type Severity } from "@/modules/incidents/shared/types";

const monthName = (key: string) => new Date(`${key}-01T12:00:00Z`).toLocaleDateString("en-IE", { month: "short", year: "numeric", timeZone: "UTC" });
const day = (iso: string) => formatDate(new Date(`${iso}T12:00:00Z`));

/** One breakdown as a list of bars, each against the largest, with its number
 *  in words beside it so the bar is never the only signal. */
function Bars({ id, title, hint, counts, label }: { id: string; title: string; hint?: string; counts: Count[]; label: (key: string) => string }) {
  const max = Math.max(1, ...counts.map((c) => c.count));
  return (
    <section aria-labelledby={id} className="pc-panel">
      <div className="space-y-1">
        <h2 id={id}>{title}</h2>
        {hint ? <p className="text-sm text-ui-muted-foreground">{hint}</p> : null}
      </div>
      {counts.every((c) => !c.count) ? <p className="text-sm text-ui-muted-foreground">None in this period.</p> : (
        <ul className="flex flex-col gap-3">
          {counts.map((c) => (
            <li key={c.key} className="flex flex-col gap-1">
              <span className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 break-words">{label(c.key)}</span>
                <span className="font-semibold tabular-nums">{c.count}</span>
              </span>
              <Progress value={(c.count / max) * 100} aria-label={`${label(c.key)}: ${c.count}`} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Figure({ value, label, hint }: { value: string | number; label: string; hint?: string }) {
  return (
    <div className="pc-stat">
      <span className="pc-stat-figure">{value}</span>
      <span className="font-semibold">{label}</span>
      {hint ? <span className="text-sm text-ui-muted-foreground">{hint}</span> : null}
    </div>
  );
}

/** Trends at the sites this person covers ("Insights"). */
export function Insights({ data }: { data: IncidentInsights }) {
  const { insights: i, months, site, sites } = data;
  const query = (change: { months?: number; site?: string | null }) => {
    const p = new URLSearchParams();
    const m = change.months ?? months, s = change.site === undefined ? site?.id : change.site;
    if (m !== 12) p.set("months", String(m));
    if (s) p.set("site", s);
    const q = p.toString();
    return `/incidents/insights${q ? `?${q}` : ""}`;
  };
  const siteName = (id: string) => sites.find((s) => s.id === id)?.name ?? "Another site";
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <SegmentedLinks label="Period" items={PERIODS.map((m) => ({ href: query({ months: m }), label: `${m} months`, current: m === months }))} />
        {sites.length > 1 ? (
          <SegmentedLinks label="Site" items={[{ href: query({ site: null }), label: "All your sites", current: !site }, ...sites.map((s) => ({ href: query({ site: s.id }), label: s.name, current: site?.id === s.id }))]} />
        ) : null}
      </div>

      <div className="pc-stats pc-stats-fill">
        <Figure value={i.total} label="Reports" hint={`Since ${monthName(data.span[0])}`} />
        <Figure value={i.nearMissRatio ?? "No accidents"} label="Near misses per accident" hint="More is better: it means people report before someone is hurt." />
        <Figure value={i.serious} label="Serious" hint={`${i.hsa} reported to the HSA`} />
        <Figure value={data.overdueActions} label="Actions overdue" hint={`${data.openActions} open in all`} />
      </div>

      {i.total === 0 ? <EmptyState icon="clipboardCheck" title="No reports in this period" hint="Try a longer period or another site." /> : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Bars id="ins-months" title="By month" counts={i.months} label={monthName} />
          <Bars id="ins-kinds" title="By kind" counts={i.kinds} label={(k) => incidentKinds[k as IncidentKind]?.label ?? k} />
          <Bars id="ins-categories" title="What they were about" counts={i.categories} label={(k) => incidentCategories[k as IncidentCategory]?.label ?? k} />
          <Bars id="ins-areas" title="Where" hint="Areas as reporters named them." counts={i.areas.slice(0, 10)} label={(k) => k} />
          <Bars id="ins-hours" title="Time of day" hint="By the hour it happened." counts={i.hours} label={(k) => k} />
          <Bars id="ins-levels" title="Severity level" hint={i.untriaged ? `${i.untriaged} not triaged yet.` : "The worse of what happened and what could have."} counts={i.levels} label={(k) => `${k} ${severities[Number(k) as Severity]?.label ?? ""}`} />
          {!site && sites.length > 1 ? <Bars id="ins-sites" title="By site" counts={i.sites} label={siteName} /> : null}
        </div>
      )}

      {data.toReview ? (
        <section aria-labelledby="ins-keep" className="pc-panel">
          <div className="space-y-1">
            <h2 id="ins-keep">{`Past their keeping period · ${data.toReview.length}`}</h2>
            <p className="text-sm text-ui-muted-foreground">Closed reports are kept for 10 years from the day they happened, or 21 when a child was involved. Nothing is deleted on its own: check with the insurer before anything is removed.</p>
          </div>
          {data.toReview.length === 0 ? <p className="text-sm text-ui-muted-foreground">None yet.</p> : (
            <ul className="pc-rows">
              {data.toReview.map((r) => (
                <li key={r.id} className="pc-row">
                  <span className="pc-row-body">
                    <Link href={`/incidents/${r.id}`} className="pc-row-title underline-offset-4 hover:underline tabular-nums">{incidentNumber(r.number)}</Link>
                    <span className="pc-row-hint tabular-nums">{incidentKinds[r.kind as IncidentKind]?.label} on {day(r.occurredOn)} · kept until {day(r.keepUntil)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
