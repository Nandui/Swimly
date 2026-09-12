"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRightLeft, CalendarCheck, ClipboardCheck, History, LoaderCircle, Trophy, UserRound } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Badge } from "@/components/shadcn/badge";
import { Alert, AlertDescription } from "@/components/shadcn/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/shadcn/dialog";
import { loadSwimmerHistory } from "@/lib/students/actions/history";
import { formatDate, formatDateTime, parseDateOnly } from "@/lib/format";
import { HISTORY_MARKS, HISTORY_META, type HistoryEvent, type HistoryPage, type HistoryQuery } from "@/lib/students/history";
import styles from "./swimmer-profile.module.css";

const ICONS = { competencies: Trophy, attendance: CalendarCheck, enrolment: ArrowRightLeft, completion: Trophy, assessment: ClipboardCheck, profile: UserRound };
function mark(value: string | null | undefined) { return value ? HISTORY_MARKS[value] ?? value : "Not marked"; }

export function CompetencyHistory({ studentId, id, name }: { studentId: string; id: string; name: string }) {
  return <Dialog><DialogTrigger asChild><Button variant="ghost" size="sm" aria-label={`History of ${name}`}><History aria-hidden="true" />History</Button></DialogTrigger>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{name}</DialogTitle><DialogDescription>Recorded competency history. Older records may show only the latest saved mark.</DialogDescription></DialogHeader>
      <HistoryFeed studentId={studentId} query={{ competencyId: id, kind: "competencies" }} />
    </DialogContent>
  </Dialog>;
}

export function HistoryRows({ events, studentId, showCompetencyLinks = true, brief = false }: { events: HistoryEvent[]; studentId: string; showCompetencyLinks?: boolean; brief?: boolean }) {
  return <ol className="divide-y divide-ui-border" aria-label="Swimmer activity">{events.map(event => {
    const Icon = ICONS[event.kind], changes = event.evidence?.changes;
    const title = changes?.length ? `${changes.length} competency ${changes.length === 1 ? "mark" : "marks"} updated` : event.title;
    if (brief) {
      const change = changes?.length === 1 ? changes[0] : null;
      const label = change ? `${change.name} — ${mark(change.after)}` : event.kind === "attendance" && event.evidence?.after ? `Attendance — ${mark(event.evidence.after)}` : title;
      return <li key={event.id} className={styles.briefEvent}>
        <time dateTime={event.date}>{formatDate(parseDateOnly(event.date))}</time>
        <Icon aria-hidden="true" className="size-5" />
        <div className="min-w-0"><p className="text-sm font-medium [overflow-wrap:anywhere]">{label}</p><p className="mt-1 text-xs text-ui-muted-foreground">{change ? `${mark(change.before)} → ${mark(change.after)} · ` : ""}{event.actor ?? "Saved record"}</p></div>
        {change && showCompetencyLinks ? <CompetencyHistory studentId={studentId} id={change.competencyId} name={change.name} /> : null}
      </li>;
    }
    return <li key={event.id} className="flex min-w-0 gap-3 py-4">
      <Icon className="mt-1 size-4 shrink-0 text-ui-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1"><p className="text-sm font-medium [overflow-wrap:anywhere]">{title}</p><time dateTime={event.date} className="text-xs text-ui-muted-foreground">{formatDate(parseDateOnly(event.date))}</time></div>
        {changes?.map(change => <div key={change.competencyId} className="flex flex-wrap items-center justify-between gap-2 py-1"><div className="min-w-0 text-sm"><p>{change.name}</p><p className="text-ui-muted-foreground">{mark(change.before)} → {mark(change.after)}</p></div>{showCompetencyLinks ? <CompetencyHistory studentId={studentId} id={change.competencyId} name={change.name} /> : null}</div>)}
        {event.evidence && "after" in event.evidence ? <p className="text-sm">{"before" in event.evidence ? `${mark(event.evidence.before)} → ` : ""}{mark(event.evidence.after)}</p> : null}
        {event.className || event.site ? <p className="text-xs text-ui-muted-foreground">{[event.className, event.site].filter(Boolean).join(" · ")}</p> : null}
        {event.evidence?.note ? <p className="whitespace-pre-wrap text-sm">{event.evidence.note}</p> : null}
        {event.evidence && "previousNote" in event.evidence && event.evidence.previousNote !== event.evidence.note ? <p className="text-xs text-ui-muted-foreground">Note changed: {event.evidence.previousNote || "None"} → {event.evidence.note || "Cleared"}</p> : null}
        <p className="text-xs text-ui-muted-foreground">{event.actor ? `${event.actor} · ` : ""}{event.snapshot ? "Saved record" : "Recorded"} {formatDateTime(new Date(event.at))}</p>
        {event.snapshot ? <Badge variant="outline" data-tone={HISTORY_META[event.kind].color}>Latest record · earlier changes unavailable</Badge> : null}
      </div>
    </li>;
  })}</ol>;
}

export function HistoryFeed({ studentId, query = {}, initial, compact = false, footer }: { studentId: string; query?: HistoryQuery; initial?: HistoryPage; compact?: boolean; footer?: React.ReactNode }) {
  return <HistoryFeedPage key={`${studentId}:${JSON.stringify(query)}:${compact}`} studentId={studentId} query={query} initial={initial} compact={compact} footer={footer} />;
}

function HistoryFeedPage({ studentId, query, initial, compact, footer }: { studentId: string; query: HistoryQuery; initial?: HistoryPage; compact: boolean; footer?: React.ReactNode }) {
  const key = JSON.stringify(query);
  const [page, setPage] = useState<HistoryPage | null>(initial ?? null), [error, setError] = useState("");
  const [pending, setPending] = useState(!initial), [expanded, setExpanded] = useState(!compact);
  const epoch = useRef(0), busy = useRef(false);
  useEffect(() => {
    const request = ++epoch.current;
    busy.current = true;
    (initial ? Promise.resolve(initial) : loadSwimmerHistory(studentId, JSON.parse(key))).then(result => { if (epoch.current === request) setPage(result); })
      .catch(() => { if (epoch.current === request) setError("Could not load the history. Try again."); })
      .finally(() => { if (epoch.current === request) { busy.current = false; setPending(false); } });
    return () => { epoch.current = request + 1; };
  }, [studentId, key, initial, compact]);
  async function more(retry = false) {
    if (busy.current) return;
    busy.current = true; setPending(true); setError(""); const request = epoch.current;
    try {
      const result = await loadSwimmerHistory(studentId, { ...JSON.parse(key), cursor: retry ? undefined : page?.next ?? undefined });
      if (request === epoch.current) setPage(old => ({ ...result, events: retry ? result.events : [...(old?.events ?? []), ...result.events].filter((event, index, all) => all.findIndex(e => e.id === event.id) === index) }));
    } catch { if (request === epoch.current) setError("Could not load the history. Try again."); }
    finally { if (request === epoch.current) { busy.current = false; setPending(false); } }
  }
  const events = expanded ? page?.events ?? [] : page?.events.slice(0, 3) ?? [];
  return <div aria-busy={pending} className="min-w-0">
    {page && !page.canAudit ? <p className="mb-3 text-sm text-ui-muted-foreground">Showing saved records. Viewing changes requires activity access.</p> : null}
    {events.length ? <HistoryRows events={events} studentId={studentId} showCompetencyLinks={!query.competencyId} brief={!expanded} /> : !pending && !error ? <p className="py-5 text-sm text-ui-muted-foreground">No recorded activity matches this view.</p> : null}
    {pending ? <p role="status" className="flex items-center gap-2 py-3 text-sm"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Loading history…</p> : null}
    {error ? <Alert variant="destructive"><AlertDescription>{error}<Button variant="outline" disabled={pending} onClick={() => more(!page)}>Try again</Button></AlertDescription></Alert> : null}
    <div className="flex flex-wrap items-center gap-2">{!expanded && page?.events.length ? <Button variant="ghost" onClick={() => setExpanded(true)}>Show all class activity</Button> : expanded && page?.next ? <Button variant="outline" disabled={pending} onClick={() => more()}>Load earlier activity</Button> : null}{footer}</div>
  </div>;
}
