import { EmptyState } from "@/components/ui-kit/empty-state";
import { Tag } from "@/components/ui-kit/tag";
import { formatDateRange, formatDay } from "@/lib/format";
import { MarkOffDialog, WithdrawOffDialog } from "@/modules/plan/features/off/components/off-dialogs";
import type { PlanOffsData } from "@/modules/plan/features/off/server/data";
import { offReasonMeta } from "@/modules/plan/shared/rules";

/** Who is off, from a week ago to three months ahead, soonest first, and marking someone off. */
export function OffList({ data }: { data: PlanOffsData }) {
  const { site, offs, people, today } = data;
  return (
    <div className="flex flex-col gap-(--space-6)">
      {people.length ? <div><MarkOffDialog siteId={site.id} people={people} today={today} /></div> : null}
      <section aria-labelledby="plan-offs" className="flex min-w-0 flex-col">
        <div className="pc-section-head"><h2 id="plan-offs">Off</h2>{offs.length ? <p>{offs.length}</p> : null}</div>
        {offs.length === 0 ? <EmptyState compact icon="calendarX" title="Nobody is marked off" hint="People marked off here show on the Week and Day." /> : (
          <ul className="pc-list">
            {offs.map((o) => (
              <li key={o.id} className="pc-row">
                <span className="pc-row-body">
                  <span className="pc-row-title">{o.name}</span>
                  <span className="pc-row-hint">{[o.firstDay === o.lastDay ? formatDay(o.firstDay) : formatDateRange(o.firstDay, o.lastDay), o.note].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="pc-row-trail">
                  <Tag meta={offReasonMeta(o.reason)} />
                  {o.canChange ? <WithdrawOffDialog siteId={site.id} id={o.id} name={o.name} /> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
