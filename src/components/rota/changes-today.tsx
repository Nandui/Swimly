import { ArrowRightLeft } from "lucide-react";
import { MarkTimepoint } from "@/components/rota/actions";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Tag } from "@/components/ui-kit/tag";
import { formatTime, minutesNow } from "@/lib/format";
import { ROTA_CHANGE_REASON_META, type RotaChangeReason } from "@/lib/rota/constants";
import type { rotaDay } from "@/lib/rota/data";

type Day = Awaited<ReturnType<typeof rotaDay>>;

/** Today's tab of This week, for duty managers: the changes made to today's shifts, with their
 *  reason and whether Timepoint has them. What needs them now is the planner's Needs you. */
export function ChangesToday({ data, manage }: { data: Day; manage: boolean }) {
  const pending = data.changes.filter((c) => !c.timepointAt).length;
  return (
    <section aria-labelledby="today-changes" className="pc-panel">
      <div className="pc-panel-head"><h2 id="today-changes">Changes today{pending ? ` · ${pending} not in Timepoint yet` : ""}</h2></div>
      {data.changes.length === 0 ? <EmptyState compact icon="calendarDays" title="No changes to today's shifts" /> : (
        <ul className="pc-rows">
          {data.changes.map((c) => {
            const reason = ROTA_CHANGE_REASON_META[c.reason as RotaChangeReason];
            return (
              <li key={c.id} className="pc-row">
                <span className="pc-tile-icon" aria-hidden="true">{reason ? <reason.icon /> : <ArrowRightLeft />}</span>
                <span className="pc-row-body">
                  <span className="pc-row-title">{c.kind === "cancelled" ? `Cancelled: ${c.before}` : c.kind === "added" ? `Added: ${c.after}` : `${c.before} → ${c.after.split(", ").at(-1)}`}</span>
                  <span className="pc-row-hint">
                    {formatTime(minutesNow(c.createdAt))} · by {c.byName}{c.note ? ` · ${c.note}` : ""} · {c.timepointAt ? `Updated in Timepoint${c.timepointByName ? ` by ${c.timepointByName}` : ""}` : "Timepoint not updated yet"}
                  </span>
                </span>
                <span className="pc-row-trail">
                  {reason ? <Tag meta={reason} /> : null}
                  {!c.timepointAt && manage ? <MarkTimepoint id={c.id} what={c.after || c.before} /> : null}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
