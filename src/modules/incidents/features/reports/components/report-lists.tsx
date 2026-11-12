import Link from "next/link";
import { ChevronRight, CircleDashed, Shield, TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Tag } from "@/components/ui-kit/tag";
import { formatDate } from "@/lib/format";
import type { IncidentRow } from "@/modules/incidents/features/reports/server/data";
import { incidentCategories, incidentKinds, incidentNumber, incidentStatuses, levelOf, seriousMeta, SEVERITY_META, type IncidentCategory, type IncidentKind, type IncidentStatus, type Severity } from "@/modules/incidents/shared/types";

const KIND_ICON = { accident: TriangleAlert, incident: Shield, near_miss: CircleDashed } as const;

/** One list of reports, as the approved canvas draws it: a tile for the kind (red when it alerted
 *  the managers, orange when someone was hurt or something went wrong), what it was about, its
 *  number, kind, site and time, and its status and severity beneath. Never who was hurt. */
export function ReportPanel({ id, title, rows, empty }: { id: string; title: string; rows: IncidentRow[]; empty: { title: string; hint?: string } }) {
  return (
    <section aria-labelledby={`${id}-h`} id={id}>
      <div className="pc-section-head"><h2 id={`${id}-h`}>{title}</h2>{rows.length ? <p>{rows.length}</p> : null}</div>
      {rows.length === 0 ? (
        <div className="pc-list"><EmptyState compact icon="clipboardCheck" title={empty.title} hint={empty.hint} /></div>
      ) : (
        <ul className="pc-list inc-reports">
          {rows.map((r) => {
            const level = r.severityActual && r.severityPotential ? levelOf(r.severityActual, r.severityPotential) as Severity : null;
            const Icon = KIND_ICON[r.kind as IncidentKind] ?? Shield;
            return (
              <li key={r.id}>
                <Link href={`/incidents/${r.id}`} className="pc-row">
                  <span className="pc-tile-icon" data-tone={r.serious ? "red" : r.kind === "near_miss" ? undefined : "orange"}><Icon aria-hidden="true" /></span>
                  <span className="pc-row-body">
                    <span className="pc-row-title">{incidentCategories[r.category as IncidentCategory]?.label ?? "Incident"}</span>
                    <span className="pc-row-hint tabular-nums">
                      {[incidentNumber(r.number), incidentKinds[r.kind as IncidentKind]?.label, [r.site.name, r.area].filter(Boolean).join(", "), `${formatDate(new Date(`${r.occurredOn}T12:00:00Z`))} ${r.occurredAt}`].filter(Boolean).join(" · ")}
                    </span>
                    <span className="inc-row-tags">
                      <Tag meta={incidentStatuses[r.status as IncidentStatus]} />
                      {level ? <Tag meta={SEVERITY_META[level]} /> : null}
                      {r.serious ? <Tag meta={seriousMeta} /> : null}
                    </span>
                  </span>
                  <ChevronRight aria-hidden="true" className="pc-row-chevron" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
