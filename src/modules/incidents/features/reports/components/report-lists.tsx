import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Tag } from "@/components/ui-kit/tag";
import { formatDate } from "@/lib/format";
import type { IncidentRow } from "@/modules/incidents/features/reports/server/data";
import { levelOf } from "@/modules/incidents/shared/rules";
import { incidentCategories, incidentKinds, incidentNumber, incidentStatuses, seriousMeta, SEVERITY_META, type IncidentCategory, type IncidentKind, type IncidentStatus, type Severity } from "@/modules/incidents/shared/types";

/** One panel of reports: each row says what, where and when, never who was hurt. */
export function ReportPanel({ id, title, rows, empty }: { id: string; title: string; rows: IncidentRow[]; empty: { title: string; hint?: string } }) {
  return (
    <section aria-labelledby={`${id}-h`} id={id} className="pc-panel">
      <div className="pc-panel-head"><h2 id={`${id}-h`}>{title}</h2></div>
      {rows.length === 0 ? (
        <EmptyState compact icon="clipboardCheck" title={empty.title} hint={empty.hint} />
      ) : (
        <ul className="pc-rows">
          {rows.map((r) => {
            const level = r.severityActual && r.severityPotential ? levelOf(r.severityActual, r.severityPotential) as Severity : null;
            return (
              <li key={r.id}>
                <Link href={`/incidents/${r.id}`} className="pc-row">
                  <span className="pc-row-body">
                    <span className="pc-row-title">{incidentCategories[r.category as IncidentCategory]?.label ?? "Incident"}</span>
                    <span className="pc-row-hint tabular-nums">
                      {[incidentNumber(r.number), incidentKinds[r.kind as IncidentKind]?.label, [r.site.name, r.area].filter(Boolean).join(", "), `${formatDate(new Date(`${r.occurredOn}T12:00:00Z`))} ${r.occurredAt}`, `by ${r.reporterName}`].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="pc-row-trail">
                    {r.serious ? <Tag meta={seriousMeta} /> : null}
                    {level ? <Tag meta={SEVERITY_META[level]} /> : null}
                    <Tag meta={incidentStatuses[r.status as IncidentStatus]} />
                    <ChevronRight aria-hidden="true" className="pc-row-chevron" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
