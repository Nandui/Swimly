import type { ReactNode } from "react";
import { ArrowDown, Ambulance, Baby, CalendarClock, Check, Eye, FileText, Hospital, Lock, ShieldAlert, UserRound } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Notice } from "@/components/ui-kit/notice";
import { RecordFact as Fact, RecordFacts, RecordHistory, RecordNext, RecordSection, RecordSteps, type RecordStepState } from "@/components/ui-kit/record";
import { Tag } from "@/components/ui-kit/tag";
import { formatDate, formatDateTime } from "@/lib/format";
import type { IncidentDetail } from "@/modules/incidents/features/reports/server/data";
import { triageAnswerRows } from "@/modules/incidents/shared/triage-guides";
import { ageGroups, incidentActions, incidentKinds, levelOf, personTypes, SEVERITY_META, type AgeGroup, type IncidentKind, type PersonType, type Severity } from "@/modules/incidents/shared/types";

/** History notes everyone who reads the report sees; the rest (statements,
 *  actions, files) only those who triage at the site. */
const OPEN_NOTES = new Set(["addendum", "reopen"]);
const day = (iso: string) => formatDate(new Date(`${iso}T12:00:00Z`));
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
/** A report closed in the same moment it was triaged skipped the investigation. */
const CLOSED_AT_TRIAGE_MS = 5_000;

type Stage = { label: string; state: RecordStepState; hint: string };

/** A level as its tag, or "Not rated yet". */
function Level({ value }: { value: Severity | null }) {
  return value ? <Tag meta={SEVERITY_META[value]} /> : <span className="rec-muted">Not rated yet</span>;
}

/** Where the report has got to, in the four steps everyone recognises. */
function stagesOf(r: IncidentDetail["report"], needsSignoff: boolean): Stage[] {
  const fastClosed = r.status === "closed" && !!r.triagedAt && !!r.closedAt && r.closedAt.getTime() - r.triagedAt.getTime() < CLOSED_AT_TRIAGE_MS;
  return [
    { label: "Reported", state: "done", hint: `${r.reporterName}, ${formatDateTime(r.createdAt)}` },
    r.triagedAt
      ? { label: "Triaged", state: "done", hint: `${r.triagedByName}, ${formatDateTime(r.triagedAt)}` }
      : { label: "Triage", state: "current", hint: "Waiting to be rated" },
    r.status === "investigating"
      ? { label: "Investigating", state: "current", hint: "Finding the cause" }
      : fastClosed
        ? { label: "Investigation", state: "skipped", hint: "Not needed: low risk" }
        : r.status === "closed"
          ? { label: "Investigated", state: "done", hint: "Cause and actions recorded" }
          : { label: "Investigation", state: "todo", hint: "If triage decides" },
    r.status === "closed" && r.closedAt
      ? { label: "Closed", state: "done", hint: `${r.closedByName}, ${formatDateTime(r.closedAt)}` }
      : { label: "Close", state: "todo", hint: needsSignoff ? "Needs a manager's sign-off" : "Locks the report" },
  ];
}

/** The history dot's tone, by what happened: closed or an action done, sent back or undone. */
const historyTone = (action: string) => action === "close" || action === "action_done" ? "done" as const
  : action === "reopen" || action === "action_cancel" || action === "file_remove" ? "warn" as const : undefined;

/** What happens next and whose move it is, from what this person may do, with the four steps
 *  under it (RecordNext: tinted blue while the move is this person's). */
function NextStep({ data, stages }: { data: IncidentDetail; stages: Stage[] }) {
  const { report: r, can } = data;
  const site = r.site.name;
  const hsaOpen = r.hsaReportable && r.status !== "closed";
  const left = hsaOpen && r.hsaDueOn ? daysBetween(data.today, r.hsaDueOn) : null;
  let act = false;
  let title: string;
  let body: string;
  let jump: { href: string; label: string } | null = null;
  let second: { href: string; label: string } | null = null;
  if (r.status === "reported") {
    if (can.triage) { act = true; title = "Triage this report"; body = "Rate what happened and what could have, answer the HSA questions, then investigate it or close it."; jump = { href: "#inc-triage", label: "Start triage" }; }
    else { title = "Waiting for triage"; body = `Someone who triages reports at ${site} will rate it and decide what happens next.`; }
  } else if (r.status === "investigating") {
    if (can.investigate) {
      act = true; title = "Investigate it"; body = "Take statements, find the root cause and raise the actions that fix it. It closes when no action is open.";
      jump = { href: "#inc-investigation-h", label: "Go to the investigation" };
      if (can.close) second = { href: "#inc-close", label: "Close the report" };
      else if (data.needsSignoff) body += " A manager signs this one off and closes it.";
    } else { title = "Under investigation"; body = `Someone who triages reports at ${site} is finding the cause and what to change. The outcome shows here when it closes.`; }
  } else {
    title = "Closed and locked";
    body = `${r.closedByName ? `Closed by ${r.closedByName}${r.closedAt ? `, ${formatDateTime(r.closedAt)}` : ""}. ` : ""}${can.reopen ? "Reopen it from the top of the page if new facts come in. " : ""}Anyone who reads it can still add to it.`;
  }
  const checklist = r.status === "investigating" && can.seeInvestigation ? [
    { done: r.statements.length > 0, label: r.statements.length ? `${r.statements.length} statement${r.statements.length === 1 ? "" : "s"} taken` : "No statements yet" },
    { done: r.rootCause.length >= 3, label: r.rootCause.length >= 3 ? "Root cause recorded" : data.needsRootCause ? "Root cause needed before closing" : "No root cause yet" },
    { done: r.actions.length > 0 && data.openActions === 0, label: r.actions.length ? `${data.openActions} of ${r.actions.length} action${r.actions.length === 1 ? "" : "s"} open` : "No actions yet" },
  ] : [];
  return (
    <RecordNext act={act} label="What happens next" title={title} body={body}>
      {checklist.length ? (
        <ul className="inc-checklist">
          {checklist.map((c) => (
            <li key={c.label} data-done={c.done ? "" : undefined}>
              <span className="inc-check" aria-hidden="true">{c.done ? <Check /> : null}</span>
              <span>{c.done ? <span className="sr-only">Done: </span> : <span className="sr-only">To do: </span>}{c.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {hsaOpen ? (
        <div className="inc-hsa" role="note" aria-label="Health and Safety Authority report">
          <p className="inc-hsa-head">
            <CalendarClock aria-hidden="true" />
            <span>Report to the HSA by {r.hsaDueOn ? day(r.hsaDueOn) : "the deadline"}</span>
          </p>
          {left !== null ? <p className="inc-hsa-count" data-late={left < 0 ? "" : undefined}>{left > 1 ? `${left} days left` : left === 1 ? "Due tomorrow" : left === 0 ? "Due today" : `${-left} day${left === -1 ? "" : "s"} late`}</p> : null}
          <p className="inc-hsa-body">{r.hsaFatal ? "Someone died: the HSA or the Gardaí must already have been told by phone. If not, phone now. " : ""}Use the HSA&apos;s online form (IR1 for an accident, IR3 for a dangerous occurrence), then record its reference when closing.</p>
        </div>
      ) : null}
      {jump || second ? (
        <div className="inc-next-actions">
          {jump ? <Button asChild><a href={jump.href}><ArrowDown aria-hidden="true" />{jump.label}</a></Button> : null}
          {second ? <Button asChild variant="outline"><a href={second.href}><Lock aria-hidden="true" />{second.label}</a></Button> : null}
        </div>
      ) : null}
      <RecordSteps steps={stages} label="Where the report has got to" />
    </RecordNext>
  );
}

/** One report as a record page (ui-kit/record.tsx), as the approved canvas lays it out: what
 *  happens next (and where the report has got to) beside the report; the report as cards of label
 *  and value rows: what happened and the account as written, the people, triage; then the working
 *  (the forms the route passes in for this person) and its history. One column on phones, next
 *  step first. */
export function ReportView({ data, forms }: { data: IncidentDetail; forms: ReactNode }) {
  const { report: r, reads } = data;
  const actual = (r.severityActual ?? null) as Severity | null;
  const potential = (r.severityPotential ?? null) as Severity | null;
  const level = actual && potential ? levelOf(actual, potential) as Severity : null;
  const failedAlerts = r.notifications.filter((n) => n.status === "FAILED");
  const stages = stagesOf(r, data.needsSignoff);
  return (
    <div className="inc-file">
      {data.can.seeAlerts && r.serious && failedAlerts.length ? (
        <Notice tone="warning" title="The serious-incident alert did not reach everyone" description={`${[...new Set(failedAlerts.map((n) => n.error).filter(Boolean))].join(" ")} Tell the centre manager directly.`} />
      ) : null}

      <div className="rec-layout">
        <NextStep data={data} stages={stages} />

        <div className="rec-main">
          <RecordSection id="inc-what-h" title="What happened" aside={<p className="inc-kept"><Lock aria-hidden="true" />Kept as written</p>}>
            <div className="rec-card">
              <RecordFacts>
                <Fact label="Kind">{incidentKinds[r.kind as IncidentKind]?.label ?? "Incident"}</Fact>
                <Fact label="Where">{[r.site.name, r.area].filter(Boolean).join(", ")}</Fact>
                <Fact label="When"><span className="tabular-nums">{day(r.occurredOn)} at {r.occurredAt}</span></Fact>
                <Fact label="Handled at"><Level value={level} /></Fact>
                {level ? <>
                  <Fact label="Happened"><Level value={actual} /></Fact>
                  <Fact label="Could have"><Level value={potential} /></Fact>
                </> : null}
              </RecordFacts>
              <p className="inc-quote">{r.description}</p>
              {r.immediateAction ? (
                <div className="rec-well">
                  <h3>Done straight away</h3>
                  <p>{r.immediateAction}</p>
                </div>
              ) : null}
              {r.raisedBy ? <p className="rec-muted">Told by <strong>{r.raisedBy}</strong>.</p> : null}
            </div>
          </RecordSection>

          <RecordSection id="inc-people-h" title="People involved" aside={<p className="inc-kept"><ShieldAlert aria-hidden="true" />Personal and health details</p>}>
            <div className="rec-card">
              {r.people.length === 0 ? <p className="rec-muted">Nobody named.</p> : (
                <ul className="inc-people">
                  {r.people.map((p, i) => {
                    const treatment = [p.firstAid ? `First aid: ${p.firstAid}${p.firstAidBy ? ` (${p.firstAidBy})` : ""}` : null].filter(Boolean);
                    return (
                      <li key={p.id} className="inc-person">
                        <div className="inc-person-head">
                          <span className="pc-tile-icon" data-tone={p.injured ? "orange" : undefined} aria-hidden="true">{p.ageGroup === "child" ? <Baby /> : <UserRound />}</span>
                          <div className="min-w-0">
                            <h3><span className="sr-only">Person {i + 1}: </span>{p.name || "Not named"}</h3>
                            <p className="rec-muted">{personTypes[p.type as PersonType]} · {ageGroups[p.ageGroup as AgeGroup]}{p.contact ? ` · ${p.contact}` : ""}</p>
                          </div>
                        </div>
                        <RecordFacts>
                          <Fact label="Injury">{p.injured ? [p.injury, p.bodyPart].filter(Boolean).join(", ") || "Hurt or ill, not described" : "Not hurt"}</Fact>
                          {p.injured ? (
                            <Fact label="Treatment">
                              {treatment.length ? treatment.join("\n") : !p.ambulance && !p.hospital ? "None recorded" : null}
                              {p.ambulance || p.hospital ? (
                                <span className="inc-chips">
                                  {p.ambulance ? <span className="inc-chip" data-tone="red"><Ambulance aria-hidden="true" />Ambulance called</span> : null}
                                  {p.hospital ? <span className="inc-chip" data-tone="orange"><Hospital aria-hidden="true" />Went to hospital or a doctor</span> : null}
                                </span>
                              ) : null}
                            </Fact>
                          ) : null}
                        </RecordFacts>
                      </li>
                    );
                  })}
                </ul>
              )}
              {r.witnesses.length ? (
                <div className="inc-witnesses">
                  <h3>Witnesses</h3>
                  <ul>
                    {r.witnesses.map((w) => <li key={w.id}><Eye aria-hidden="true" /><span><strong>{w.name}</strong>{w.contact ? `, ${w.contact}` : ""}</span></li>)}
                  </ul>
                </div>
              ) : null}
            </div>
          </RecordSection>

          {r.triagedAt ? (
            <RecordSection id="inc-triaged-h" title="Triage">
              <div className="rec-card">
                <RecordFacts>
                  <Fact label="HSA">{r.hsaReportable ? `Reportable, due by ${r.hsaDueOn ? day(r.hsaDueOn) : "the deadline"}${r.hsaReference ? `. Reference: ${r.hsaReference}` : ""}` : "Not reportable"}</Fact>
                  {r.parentInformed ? <Fact label="Parent or guardian told">{r.parentInformed}</Fact> : null}
                  {triageAnswerRows({ category: r.category, hasStaff: r.people.some((p) => p.type === "staff") }, r.triageAnswers).map(([label, text]) => <Fact key={label} label={label}>{text}</Fact>)}
                </RecordFacts>
                <div className="rec-well">
                  <h3>Note from {r.triagedByName}</h3>
                  <p>{r.triageNote}</p>
                </div>
                {r.closedAt && r.closeNote && r.closeNote !== r.triageNote ? (
                  <div className="rec-well" data-tone="green">
                    <h3>Closed by {r.closedByName}, {formatDateTime(r.closedAt)}</h3>
                    <p>{r.closeNote}</p>
                  </div>
                ) : null}
              </div>
            </RecordSection>
          ) : null}

          <div className="inc-forms">{forms}</div>
        </div>

        <div className="rec-side">
          <RecordSection id="inc-history-h" title="History">
            <RecordHistory items={r.events.map((e) => ({
              key: e.id, tone: historyTone(e.action),
              title: incidentActions[e.action as keyof typeof incidentActions] ?? e.action,
              meta: `${e.actorName} · ${formatDateTime(e.createdAt)}`,
              note: e.note && (OPEN_NOTES.has(e.action) || data.can.seeInvestigation) && e.action !== "triage" && e.action !== "close" ? e.note : null,
            }))} />
          </RecordSection>

          {reads.length ? (
            <RecordSection id="inc-reads-h" title="Who opened the injury details">
              <ul className="rec-card inc-reads">
                {reads.map((x) => <li key={x.id}><FileText aria-hidden="true" /><span>{x.actorName} <span className="rec-muted">· {formatDateTime(x.createdAt)}</span></span></li>)}
              </ul>
            </RecordSection>
          ) : null}
        </div>
      </div>
    </div>
  );
}
