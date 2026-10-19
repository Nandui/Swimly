import type { ReactNode } from "react";
import { formatDate, formatDateTime } from "@/lib/format";
import type { IncidentExport } from "@/modules/incidents/features/export/server/data";
import { levelOf } from "@/modules/incidents/shared/types";
import { triageAnswerRows } from "@/modules/incidents/shared/triage-guides";
import { actionStatuses, ageGroups, incidentActions, incidentCategories, incidentKinds, incidentNumber, incidentStatuses, personTypes, severities,
  type AgeGroup, type IncidentCategory, type IncidentKind, type IncidentStatus, type PersonType, type Severity } from "@/modules/incidents/shared/types";

const day = (iso: string) => formatDate(new Date(`${iso}T12:00:00Z`));
const rated = (n: number | null) => (n ? `${n} ${severities[n as Severity].label}` : "Not rated");

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="pc-panel break-inside-avoid">
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}

/** Label and value pairs, in two columns where there is room. */
function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0 space-y-1">
          <dt className="text-xs font-semibold tracking-wide text-ui-muted-foreground uppercase">{label}</dt>
          <dd className="text-sm break-words whitespace-pre-line">{value || "None"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The whole record of one report, laid out to print or save as a PDF. */
export function ExportView({ data }: { data: IncidentExport }) {
  const { report: r } = data;
  const level = r.severityActual && r.severityPotential ? levelOf(r.severityActual, r.severityPotential) : null;
  const addenda = r.events.filter((e) => e.action === "addendum");
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-ui-muted-foreground">
        {`${incidentNumber(r.number)} as held in Turnfin on ${formatDateTime(data.exportedAt)}, opened by ${data.exportedBy}. Confidential: it holds health information. Share it only with the insurer or your adviser.`}
      </p>

      <Section id="exp-report" title="The report">
        <Facts rows={[
          ["Kind", `${incidentKinds[r.kind as IncidentKind]?.label}: ${incidentCategories[r.category as IncidentCategory]?.label}`],
          ["Status", incidentStatuses[r.status as IncidentStatus]?.label],
          ["Where", [r.site.name, r.area].filter(Boolean).join(", ")],
          ["When", `${day(r.occurredOn)} at ${r.occurredAt}`],
          ["Reported by", `${r.reporterName}, ${formatDateTime(r.createdAt)}`],
          ["Told by", r.raisedBy || "Seen by the reporter"],
          ["What happened", r.description],
          ["What was done straight away", r.immediateAction],
        ]} />
        {addenda.length ? (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Added later</h3>
            <ol className="flex flex-col gap-2 text-sm">
              {addenda.map((e) => <li key={e.id}><span className="text-ui-muted-foreground">{e.actorName}, {formatDateTime(e.createdAt)}: </span><span className="whitespace-pre-line">{e.note}</span></li>)}
            </ol>
          </div>
        ) : null}
      </Section>

      <Section id="exp-people" title="People involved">
        {r.people.length === 0 ? <p className="text-sm">Nobody named.</p> : r.people.map((p, i) => (
          <div key={p.id} className="flex flex-col gap-3 border-t border-ui-border pt-3 first:border-0 first:pt-0">
            <h3 className="text-sm font-semibold">{`Person ${i + 1}`}</h3>
            <Facts rows={[
              ["Who", [p.name || "Not named", personTypes[p.type as PersonType], ageGroups[p.ageGroup as AgeGroup]].join(" · ")],
              ["Contact", p.contact],
              ["Injury", p.injured ? [p.injury, p.bodyPart].filter(Boolean).join(", ") || "Hurt or ill, not described" : "Not hurt"],
              ["First aid", p.firstAid ? `${p.firstAid}${p.firstAidBy ? ` (by ${p.firstAidBy})` : ""}` : ""],
              ["Ambulance", p.ambulance ? "Called" : "No"],
              ["Hospital or doctor", p.hospital ? "Yes" : "No"],
            ]} />
          </div>
        ))}
        {r.witnesses.length ? <Facts rows={[["Witnesses", r.witnesses.map((w) => [w.name, w.contact].filter(Boolean).join(", ")).join("\n")]]} /> : null}
      </Section>

      {r.triagedAt ? (
        <Section id="exp-triage" title="Triage">
          <Facts rows={[
            ["What happened", rated(r.severityActual)],
            ["What could have happened", rated(r.severityPotential)],
            ["Handled at", rated(level)],
            ["Health and Safety Authority", r.hsaReportable ? `Reportable${r.hsaFatal ? " (a death)" : ""}, due by ${r.hsaDueOn ? day(r.hsaDueOn) : "the deadline"}${r.hsaReference ? `. Reference: ${r.hsaReference}` : ""}` : "Not reportable"],
            ["Parent or guardian told", r.parentInformed],
            ...triageAnswerRows({ category: r.category, hasStaff: r.people.some((p) => p.type === "staff") }, r.triageAnswers),
            [`Note from ${r.triagedByName}, ${formatDateTime(r.triagedAt)}`, r.triageNote],
          ]} />
        </Section>
      ) : null}

      {r.statements.length || r.whys.length || r.rootCause || r.actions.length ? (
        <Section id="exp-investigation" title="Investigation">
          {r.statements.map((s, i) => (
            <div key={s.id} className="space-y-1">
              <h3 className="text-sm font-semibold">{`Statement ${i + 1}: ${s.givenBy}${s.givenAs ? `, ${s.givenAs}` : ""}, ${day(s.takenOn)}`}</h3>
              <p className="text-sm whitespace-pre-line">{s.text}</p>
              <p className="text-xs text-ui-muted-foreground">Recorded by {s.recordedByName}</p>
            </div>
          ))}
          {r.whys.length ? (
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">Why it happened</h3>
              <ol className="list-decimal space-y-1 pl-5 text-sm">{r.whys.map((w, i) => <li key={i}>{w}</li>)}</ol>
            </div>
          ) : null}
          {r.rootCause ? <Facts rows={[["Root cause", r.rootCause]]} /> : null}
          {r.actions.length ? (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Actions</h3>
              <ul className="flex flex-col gap-2 text-sm">
                {r.actions.map((a) => (
                  <li key={a.id}>
                    <span className="whitespace-pre-line">{a.title}</span>
                    <span className="block text-ui-muted-foreground">
                      {`${a.ownerName}, due ${day(a.dueOn)}. ${actionStatuses[a.status as "open" | "done" | "cancelled"]?.label ?? a.status}${a.doneAt ? ` ${formatDateTime(a.doneAt)}${a.doneByName ? ` by ${a.doneByName}` : ""}` : ""}${a.note ? `: ${a.note}` : ""}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Section>
      ) : null}

      {r.closedAt ? (
        <Section id="exp-closed" title="Closed">
          <Facts rows={[[`By ${r.closedByName}, ${formatDateTime(r.closedAt)}`, r.closeNote]]} />
        </Section>
      ) : null}

      <Section id="exp-files" title="Photos and files">
        {r.files.length === 0 ? <p className="text-sm">None.</p> : (
          <ul className="flex flex-col gap-1 text-sm">
            {r.files.map((f) => <li key={f.id}>{f.name} <span className="text-ui-muted-foreground">· {f.addedByName}, {formatDateTime(f.createdAt)}</span></li>)}
          </ul>
        )}
        <p className="text-xs text-ui-muted-foreground">Send the files themselves from the report page if the insurer asks for them.</p>
      </Section>

      {r.footage.length ? (
        <Section id="exp-footage" title="CCTV footage">
          <ul className="flex flex-col gap-1 text-sm">
            {r.footage.map((f) => <li key={f.id}>{f.name} <span className="text-ui-muted-foreground">· sent by {f.uploadedBy}{f.receivedAt ? `, ${formatDateTime(f.receivedAt)}` : ""}</span></li>)}
          </ul>
          <p className="text-xs text-ui-muted-foreground">The videos are kept with the report. Download them from the report page if the insurer asks for them.</p>
        </Section>
      ) : null}

      <Section id="exp-history" title="History">
        <ol className="flex flex-col gap-1 text-sm">
          {r.events.map((e) => <li key={e.id}>{incidentActions[e.action as keyof typeof incidentActions] ?? e.action} <span className="text-ui-muted-foreground">· {e.actorName} · {formatDateTime(e.createdAt)}</span></li>)}
        </ol>
      </Section>
    </div>
  );
}
