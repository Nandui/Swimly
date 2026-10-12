import { Tag } from "@/components/ui-kit/tag";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { formatDate } from "@/lib/format";
import type { YourActions } from "@/modules/incidents/features/investigation/server/data";
import { FinishAction } from "@/modules/incidents/features/investigation/components/investigation";
import { actionStatus, actionStatuses, incidentNumber } from "@/modules/incidents/shared/types";

const day = (iso: string) => formatDate(new Date(`${iso}T12:00:00Z`));

/** The open actions this person owns. They may mark one done here without
 *  being able to open the report itself. */
export function YourActionsPanel({ data }: { data: YourActions }) {
  return (
    <section aria-labelledby="your-actions-h" id="your-actions" className="pc-panel">
      <div className="pc-panel-head"><h2 id="your-actions-h">{`Your actions · ${data.rows.length}`}</h2></div>
      {data.rows.length === 0 ? <EmptyState compact icon="clipboardCheck" title="No actions for you" /> : (
        <ul className="pc-rows">
          {data.rows.map((a) => (
            <li key={a.id} className="pc-row flex-wrap">
              <span className="pc-row-body">
                <span className="pc-row-title whitespace-pre-line">{a.title}</span>
                <span className="pc-row-hint tabular-nums">{incidentNumber(a.report.number)} · {a.site.name} · due {day(a.dueOn)} · from {a.createdByName}</span>
              </span>
              <span className="pc-row-trail">
                <Tag meta={actionStatuses[actionStatus({ status: "open", dueOn: a.dueOn }, data.today)]} />
                <FinishAction action={a} mayCancel={false} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
