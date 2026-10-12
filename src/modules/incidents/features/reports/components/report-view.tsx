import type { ReactNode } from "react";
import { Notice } from "@/components/ui-kit/notice";
import { Tag } from "@/components/ui-kit/tag";
import { formatDate, formatDateTime } from "@/lib/format";
import type { IncidentDetail } from "@/modules/incidents/features/reports/server/data";
import { levelOf } from "@/modules/incidents/shared/rules";
import { ageGroups, incidentActions, incidentCategories, incidentKinds, personTypes, SEVERITY_META, type AgeGroup, type IncidentCategory, type IncidentKind, type PersonType, type Severity } from "@/modules/incidents/shared/types";

/** History notes everyone who reads the report sees; the rest (statements,
 *  actions, files) only those who triage at the site. */
const OPEN_NOTES = new Set(["addendum", "reopen"]);
const day = (iso: string) => formatDate(new Date(`${iso}T12:00:00Z`));

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold tracking-wide text-ui-muted-foreground uppercase">{label}</h3>
      <div className="text-sm whitespace-pre-line">{children}</div>
    </div>
  );
}

/** One report as it was written, then triage, then its history. The route
 *  passes in the forms this person may use (triage, close, add to it). */
export function ReportView({ data, forms }: { data: IncidentDetail; forms: ReactNode }) {
  const { report: r, reads } = data;
  const level = r.severityActual && r.severityPotential ? levelOf(r.severityActual, r.severityPotential) as Severity : null;
  const failedAlerts = r.notifications.filter((n) => n.status === "FAILED");
  return (
    <div className="flex flex-col gap-6">
      {data.can.seeAlerts && r.serious && failedAlerts.length ? (
        <Notice tone="warning" title="The serious-incident alert did not reach everyone" description={`${[...new Set(failedAlerts.map((n) => n.error).filter(Boolean))].join(" ")} Tell the centre manager directly.`} />
      ) : null}
      {r.hsaReportable && r.status !== "closed" ? <Notice tone="warning" title={`Report this to the HSA by ${r.hsaDueOn ? day(r.hsaDueOn) : "the deadline"}`} description={`${r.hsaFatal ? "Someone died: the HSA or the Gardaí must already have been told by phone. If not, phone now. " : ""}Use the HSA's online form (IR1 for an accident, IR3 for a dangerous occurrence), then record its reference when closing.`} /> : null}

      <article aria-label="The report" className="pc-panel flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-3">
          <Fact label="What kind">{incidentKinds[r.kind as IncidentKind]?.label}: {incidentCategories[r.category as IncidentCategory]?.label}</Fact>
          <Fact label="Where">{[r.site.name, r.area].filter(Boolean).join(", ")}</Fact>
          <Fact label="When"><span className="tabular-nums">{day(r.occurredOn)} at {r.occurredAt}</span></Fact>
        </div>
        <Fact label="What happened">{r.description}</Fact>
        {r.immediateAction ? <Fact label="What was done straight away">{r.immediateAction}</Fact> : null}
        {r.raisedBy ? <Fact label="Told by">{r.raisedBy}</Fact> : null}
        <p className="text-xs text-ui-muted-foreground">Reported by {r.reporterName}, {formatDateTime(r.createdAt)}. Kept as written.</p>
      </article>

      <section aria-labelledby="inc-people-h" className="pc-panel flex flex-col gap-4">
        <h2 id="inc-people-h">People involved</h2>
        {r.people.length === 0 ? <p className="text-sm text-ui-muted-foreground">Nobody named.</p> : (
          <ul className="flex flex-col gap-4">
            {r.people.map((p, i) => (
              <li key={p.id} className="grid gap-4 rounded-[var(--pc-radius-inner)] border border-ui-border p-4 sm:grid-cols-3">
                <Fact label={`Person ${i + 1}`}>{[p.name || "Not named", personTypes[p.type as PersonType], ageGroups[p.ageGroup as AgeGroup]].join(" · ")}{p.contact ? `\n${p.contact}` : ""}</Fact>
                {p.injured ? (
                  <>
                    <Fact label="Injury">{[p.injury, p.bodyPart].filter(Boolean).join(", ") || "Hurt or ill, not described"}</Fact>
                    <Fact label="Treatment">{[p.firstAid ? `First aid: ${p.firstAid}${p.firstAidBy ? ` (${p.firstAidBy})` : ""}` : null, p.ambulance ? "Ambulance called" : null, p.hospital ? "Went to hospital or a doctor" : null].filter(Boolean).join("\n") || "None recorded"}</Fact>
                  </>
                ) : <Fact label="Injury">Not hurt</Fact>}
              </li>
            ))}
          </ul>
        )}
        {r.witnesses.length ? <Fact label="Witnesses">{r.witnesses.map((w) => [w.name, w.contact].filter(Boolean).join(", ")).join("\n")}</Fact> : null}
      </section>

      {r.triagedAt ? (
        <section aria-labelledby="inc-triaged-h" className="pc-panel flex flex-col gap-4">
          <h2 id="inc-triaged-h">Triage</h2>
          <div className="flex flex-wrap gap-2">
            {r.severityActual ? <Tag meta={SEVERITY_META[r.severityActual as Severity]} label={`Happened: ${SEVERITY_META[r.severityActual as Severity].label}`} /> : null}
            {r.severityPotential ? <Tag meta={SEVERITY_META[r.severityPotential as Severity]} label={`Could have: ${SEVERITY_META[r.severityPotential as Severity].label}`} /> : null}
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            <Fact label="Handled at">{level ? SEVERITY_META[level].label : "Not rated"}</Fact>
            <Fact label="HSA">{r.hsaReportable ? `Reportable, due by ${r.hsaDueOn ? day(r.hsaDueOn) : "the deadline"}${r.hsaReference ? `. Reference: ${r.hsaReference}` : ""}` : "Not reportable"}</Fact>
            {r.parentInformed ? <Fact label="Parent or guardian told">{r.parentInformed}</Fact> : null}
          </div>
          <Fact label={`Note from ${r.triagedByName}`}>{r.triageNote}</Fact>
          {r.closedAt && r.closeNote && r.closeNote !== r.triageNote ? <Fact label={`Closed by ${r.closedByName}, ${formatDateTime(r.closedAt)}`}>{r.closeNote}</Fact> : null}
        </section>
      ) : null}

      {forms}

      <section aria-labelledby="inc-history-h" className="pc-panel flex flex-col gap-3">
        <h2 id="inc-history-h">History</h2>
        <ol className="flex flex-col gap-3">
          {r.events.map((e) => (
            <li key={e.id} className="text-sm">
              <span className="font-semibold">{incidentActions[e.action as keyof typeof incidentActions] ?? e.action}</span>
              <span className="text-ui-muted-foreground"> · {e.actorName} · {formatDateTime(e.createdAt)}</span>
              {e.note && (OPEN_NOTES.has(e.action) || data.can.seeInvestigation) && e.action !== "triage" && e.action !== "close" ? <p className="mt-1 whitespace-pre-line">{e.note}</p> : null}
            </li>
          ))}
        </ol>
      </section>

      {reads.length ? (
        <section aria-labelledby="inc-reads-h" className="pc-panel flex flex-col gap-3">
          <h2 id="inc-reads-h">Who opened the injury details</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {reads.map((x) => <li key={x.id}>{x.actorName} <span className="text-ui-muted-foreground">· {formatDateTime(x.createdAt)}</span></li>)}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
