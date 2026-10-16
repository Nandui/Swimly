import type { ReactNode } from "react";
import { ArrowDown, Ambulance, Baby, CalendarClock, Check, Clock, Eye, FileText, Hospital, Lock, MapPin, ShieldAlert, UserRound } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Notice } from "@/components/ui-kit/notice";
import { Tag } from "@/components/ui-kit/tag";
import { formatDate, formatDateTime } from "@/lib/format";
import type { IncidentDetail } from "@/modules/incidents/features/reports/server/data";
import { levelOf } from "@/modules/incidents/shared/rules";
import { ageGroups, incidentActions, incidentCategories, incidentKinds, personTypes, severities, SEVERITY_META, type AgeGroup, type IncidentCategory, type IncidentKind, type PersonType, type Severity } from "@/modules/incidents/shared/types";

/** History notes everyone who reads the report sees; the rest (statements,
 *  actions, files) only those who triage at the site. */
const OPEN_NOTES = new Set(["addendum", "reopen"]);
const day = (iso: string) => formatDate(new Date(`${iso}T12:00:00Z`));
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
/** A report closed in the same moment it was triaged skipped the investigation. */
const CLOSED_AT_TRIAGE_MS = 5_000;

type StageState = "done" | "current" | "todo" | "skipped";
type Stage = { label: string; state: StageState; hint: string };

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="inc-fact">
      <h3 className="inc-label">{label}</h3>
      <div className="inc-fact-value">{children}</div>
    </div>
  );
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

/** The five-step scale as a meter, so a level reads at a glance and by its words. */
function Meter({ value, label }: { value: Severity | null; label: string }) {
  return (
    <div className="inc-meter-row">
      <span className="inc-meter-label">{label}</span>
      <span className="inc-meter" data-level={value ?? 0} aria-hidden="true">
        {[1, 2, 3, 4, 5].map((n) => <span key={n} data-on={value !== null && n <= value ? "" : undefined} />)}
      </span>
      <span className="inc-meter-value">{value ? SEVERITY_META[value].label : "Not rated"}</span>
    </div>
  );
}

/** What happens next and whose move it is, from what this person may do. */
function NextStep({ data }: { data: IncidentDetail }) {
  const { report: r, can } = data;
  const site = r.site.name;
  const hsaOpen = r.hsaReportable && r.status !== "closed";
  const left = hsaOpen && r.hsaDueOn ? daysBetween(data.today, r.hsaDueOn) : null;
  let tone: "act" | "wait" | "done" = "wait";
  let title: string;
  let body: string;
  let jump: { href: string; label: string } | null = null;
  let second: { href: string; label: string } | null = null;
  if (r.status === "reported") {
    if (can.triage) { tone = "act"; title = "Triage this report"; body = "Rate what happened and what could have, answer the HSA questions, then investigate it or close it."; jump = { href: "#inc-triage", label: "Start triage" }; }
    else { title = "Waiting for triage"; body = `Someone who triages reports at ${site} will rate it and decide what happens next.`; }
  } else if (r.status === "investigating") {
    if (can.investigate) {
      tone = "act"; title = "Investigate it"; body = "Take statements, find the root cause and raise the actions that fix it. It closes when no action is open.";
      jump = { href: "#inc-investigation-h", label: "Go to the investigation" };
      if (can.close) second = { href: "#inc-close", label: "Close the report" };
      else if (data.needsSignoff) body += " A manager signs this one off and closes it.";
    } else { title = "Under investigation"; body = `Someone who triages reports at ${site} is finding the cause and what to change. The outcome shows here when it closes.`; }
  } else {
    tone = "done"; title = "Closed and locked";
    body = `${r.closedByName ? `Closed by ${r.closedByName}${r.closedAt ? `, ${formatDateTime(r.closedAt)}` : ""}. ` : ""}${can.reopen ? "Reopen it from the top of the page if new facts come in. " : ""}Anyone who reads it can still add to it.`;
  }
  const checklist = r.status === "investigating" && can.seeInvestigation ? [
    { done: r.statements.length > 0, label: r.statements.length ? `${r.statements.length} statement${r.statements.length === 1 ? "" : "s"} taken` : "No statements yet" },
    { done: r.rootCause.length >= 3, label: r.rootCause.length >= 3 ? "Root cause recorded" : data.needsRootCause ? "Root cause needed before closing" : "No root cause yet" },
    { done: r.actions.length > 0 && data.openActions === 0, label: r.actions.length ? `${data.openActions} of ${r.actions.length} action${r.actions.length === 1 ? "" : "s"} open` : "No actions yet" },
  ] : [];
  return (
    <section aria-labelledby="inc-next-h" className="inc-card inc-next" data-tone={tone}>
      <span className="inc-eyebrow">What happens next</span>
      <h2 id="inc-next-h" className="inc-next-title">{title}</h2>
      <p className="inc-next-body">{body}</p>
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
          {jump ? <Button asChild className="min-h-11"><a href={jump.href}><ArrowDown aria-hidden="true" />{jump.label}</a></Button> : null}
          {second ? <Button asChild variant="outline" className="min-h-11"><a href={second.href}><Lock aria-hidden="true" />{second.label}</a></Button> : null}
        </div>
      ) : null}
    </section>
  );
}

/** One report as a case file: what it is and where it has got to, what
 *  happens next, the account as written, the people, triage, the working
 *  (the forms the route passes in for this person) and its history. */
export function ReportView({ data, forms }: { data: IncidentDetail; forms: ReactNode }) {
  const { report: r, reads } = data;
  const actual = (r.severityActual ?? null) as Severity | null;
  const potential = (r.severityPotential ?? null) as Severity | null;
  const level = actual && potential ? levelOf(actual, potential) as Severity : null;
  const failedAlerts = r.notifications.filter((n) => n.status === "FAILED");
  const kind = incidentKinds[r.kind as IncidentKind]?.label;
  const category = incidentCategories[r.category as IncidentCategory]?.label;
  const stages = stagesOf(r, data.needsSignoff);
  return (
    <div className="inc-file">
      {data.can.seeAlerts && r.serious && failedAlerts.length ? (
        <Notice tone="warning" title="The serious-incident alert did not reach everyone" description={`${[...new Set(failedAlerts.map((n) => n.error).filter(Boolean))].join(" ")} Tell the centre manager directly.`} />
      ) : null}

      <div className="inc-bento">
        <section aria-labelledby="inc-what-h" className="inc-card inc-hero">
          <div className="inc-hero-main">
            <span className="inc-eyebrow" data-kind={r.kind}>{kind}</span>
            <h2 id="inc-what-h" className="inc-headline">{category}</h2>
            <ul className="inc-where">
              <li><MapPin aria-hidden="true" />{[r.site.name, r.area].filter(Boolean).join(", ")}</li>
              <li><Clock aria-hidden="true" /><span className="tabular-nums">{day(r.occurredOn)} at {r.occurredAt}</span></li>
            </ul>
          </div>
          <div className="inc-severity" data-level={level ?? 0}>
            <span className="inc-label">Handled at</span>
            <p className="inc-level">
              {level ? <><span className="inc-level-n">{level}</span><span className="inc-level-word">{severities[level].label}</span></> : <span className="inc-level-word">Not rated yet</span>}
            </p>
            <Meter value={actual} label="Happened" />
            <Meter value={potential} label="Could have" />
          </div>
          <ol className="inc-stages" aria-label="Where the report has got to">
            {stages.map((s) => (
              <li key={s.label} data-state={s.state} aria-current={s.state === "current" ? "step" : undefined}>
                <span className="inc-stage-dot" aria-hidden="true">{s.state === "done" ? <Check /> : null}</span>
                <span className="inc-stage-label">{s.label}</span>
                <span className="inc-stage-hint">{s.hint}</span>
              </li>
            ))}
          </ol>
        </section>

        <div className="inc-next-slot"><NextStep data={data} /></div>

        <div className="inc-main">
          <article aria-labelledby="inc-account-h" className="inc-card">
            <div className="inc-card-head">
              <h2 id="inc-account-h">What happened</h2>
              <span className="inc-kept"><Lock aria-hidden="true" />Kept as written</span>
            </div>
            <p className="inc-quote">{r.description}</p>
            {r.immediateAction ? (
              <div className="inc-well">
                <h3 className="inc-label">Done straight away</h3>
                <p className="inc-well-text">{r.immediateAction}</p>
              </div>
            ) : null}
            <p className="inc-byline">
              <UserRound aria-hidden="true" />
              <span>Reported by <strong>{r.reporterName}</strong>, {formatDateTime(r.createdAt)}{r.raisedBy ? <>. Told by <strong>{r.raisedBy}</strong></> : null}.</span>
            </p>
          </article>

          <section aria-labelledby="inc-people-h" className="inc-card">
            <div className="inc-card-head">
              <h2 id="inc-people-h">People involved</h2>
              <span className="inc-kept"><ShieldAlert aria-hidden="true" />Personal and health details</span>
            </div>
            {r.people.length === 0 ? <p className="inc-muted">Nobody named.</p> : (
              <ul className="inc-people">
                {r.people.map((p, i) => {
                  const treatment = [p.firstAid ? `First aid: ${p.firstAid}${p.firstAidBy ? ` (${p.firstAidBy})` : ""}` : null].filter(Boolean);
                  return (
                    <li key={p.id} className="inc-well inc-person">
                      <div className="inc-person-head">
                        <span className="inc-avatar" aria-hidden="true">{p.ageGroup === "child" ? <Baby /> : <UserRound />}</span>
                        <div className="inc-person-name">
                          <h3><span className="sr-only">Person {i + 1}: </span>{p.name || "Not named"}</h3>
                          <p>{personTypes[p.type as PersonType]} · {ageGroups[p.ageGroup as AgeGroup]}</p>
                          {p.contact ? <p className="inc-person-contact">{p.contact}</p> : null}
                        </div>
                      </div>
                      <div className="inc-person-facts">
                        <Fact label="Injury">{p.injured ? [p.injury, p.bodyPart].filter(Boolean).join(", ") || "Hurt or ill, not described" : "Not hurt"}</Fact>
                        {p.injured ? (
                          <Fact label="Treatment">
                            {treatment.length ? treatment.join("\n") : !p.ambulance && !p.hospital ? "None recorded" : null}
                            {p.ambulance || p.hospital ? (
                              <span className="inc-chips">
                                {p.ambulance ? <span className="inc-chip" data-tone="danger"><Ambulance aria-hidden="true" />Ambulance called</span> : null}
                                {p.hospital ? <span className="inc-chip" data-tone="warning"><Hospital aria-hidden="true" />Went to hospital or a doctor</span> : null}
                              </span>
                            ) : null}
                          </Fact>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {r.witnesses.length ? (
              <div className="inc-witnesses">
                <h3 className="inc-label">Witnesses</h3>
                <ul>
                  {r.witnesses.map((w) => <li key={w.id}><Eye aria-hidden="true" /><span><strong>{w.name}</strong>{w.contact ? `, ${w.contact}` : ""}</span></li>)}
                </ul>
              </div>
            ) : null}
          </section>

          {r.triagedAt ? (
            <section aria-labelledby="inc-triaged-h" className="inc-card">
              <div className="inc-card-head">
                <h2 id="inc-triaged-h">Triage</h2>
                <span className="inc-tags">
                  {actual ? <Tag meta={SEVERITY_META[actual]} label={`Happened: ${SEVERITY_META[actual].label}`} /> : null}
                  {potential ? <Tag meta={SEVERITY_META[potential]} label={`Could have: ${SEVERITY_META[potential].label}`} /> : null}
                </span>
              </div>
              <div className="inc-facts">
                <Fact label="HSA">{r.hsaReportable ? `Reportable, due by ${r.hsaDueOn ? day(r.hsaDueOn) : "the deadline"}${r.hsaReference ? `. Reference: ${r.hsaReference}` : ""}` : "Not reportable"}</Fact>
                {r.parentInformed ? <Fact label="Parent or guardian told">{r.parentInformed}</Fact> : null}
              </div>
              <div className="inc-note">
                <p className="inc-note-by">Note from {r.triagedByName}</p>
                <p className="inc-note-text">{r.triageNote}</p>
              </div>
              {r.closedAt && r.closeNote && r.closeNote !== r.triageNote ? (
                <div className="inc-note" data-tone="done">
                  <p className="inc-note-by">Closed by {r.closedByName}, {formatDateTime(r.closedAt)}</p>
                  <p className="inc-note-text">{r.closeNote}</p>
                </div>
              ) : null}
            </section>
          ) : null}

          <div className="inc-forms">{forms}</div>
        </div>

        <section aria-labelledby="inc-history-h" className="inc-card inc-history-card">
          <h2 id="inc-history-h">History</h2>
          <ol className="inc-history">
            {r.events.map((e) => (
              <li key={e.id} data-action={e.action}>
                <span className="inc-history-dot" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="inc-history-title">{incidentActions[e.action as keyof typeof incidentActions] ?? e.action}</p>
                  <p className="inc-history-meta">{e.actorName} · {formatDateTime(e.createdAt)}</p>
                  {e.note && (OPEN_NOTES.has(e.action) || data.can.seeInvestigation) && e.action !== "triage" && e.action !== "close" ? <p className="inc-history-note">{e.note}</p> : null}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {reads.length ? (
          <section aria-labelledby="inc-reads-h" className="inc-card inc-reads-card">
            <h2 id="inc-reads-h">Who opened the injury details</h2>
            <ul className="inc-reads">
              {reads.map((x) => <li key={x.id}><FileText aria-hidden="true" /><span>{x.actorName} <span className="inc-muted">· {formatDateTime(x.createdAt)}</span></span></li>)}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
