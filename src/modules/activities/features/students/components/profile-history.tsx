"use client";

import { EmptyState } from "@/components/ui-kit/empty-state";
import { useEffect, useRef, useState } from "react";
import { ArrowRightLeft, CalendarCheck, ClipboardCheck, History, LoaderCircle, Trophy, UserRound } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Notice } from "@/components/ui-kit/notice";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/shadcn/dialog";
import { loadSwimmerHistory } from "@/modules/activities/features/students/server/actions/history";
import { formatDate, formatDateTime, parseDateOnly } from "@/lib/format";
import type { HistoryEvent, HistoryPage, HistoryQuery } from "@/modules/activities/features/students/server/history";
import { COMPETENCY_STATUS_META } from "@/modules/activities/shared/progression/constants";
import { ATTENDANCE_STATUS_META } from "@/modules/activities/shared/attendance/constants";
import styles from "@/modules/activities/features/students/components/swimmer-profile.module.css";

const ICONS = { competencies: Trophy, attendance: CalendarCheck, enrolment: ArrowRightLeft, completion: Trophy, assessment: ClipboardCheck, profile: UserRound };
/** A recorded mark in the words the rest of the app uses for it. */
function mark(value: string | null | undefined) {
  if (!value) return "Not marked";
  if (value in COMPETENCY_STATUS_META) return COMPETENCY_STATUS_META[value as keyof typeof COMPETENCY_STATUS_META].label;
  if (value in ATTENDANCE_STATUS_META) return ATTENDANCE_STATUS_META[value as keyof typeof ATTENDANCE_STATUS_META].label;
  return value;
}

export function CompetencyHistory({ studentId, id, name }: { studentId: string; id: string; name: string }) {
  return <Dialog><DialogTrigger asChild><Button variant="ghost" aria-label={`History of ${name}`}><History aria-hidden="true" />History</Button></DialogTrigger>
    <DialogContent className="max-h-(--pc-overlay-max-height) overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{name}</DialogTitle><DialogDescription>Recorded competency history. Older records may show only the latest saved mark.</DialogDescription></DialogHeader>
      <HistoryFeed studentId={studentId} query={{ competencyId: id, kind: "competencies" }} />
    </DialogContent>
  </Dialog>;
}

function HistoryRows({ events, studentId, showCompetencyLinks = true, brief = false }: { events: HistoryEvent[]; studentId: string; showCompetencyLinks?: boolean; brief?: boolean }) {
  return <ol className={brief ? "flex flex-col" : "pc-rows"} aria-label="Swimmer activity">{events.map(event => {
    const Icon = ICONS[event.kind], changes = event.evidence?.changes;
    const title = changes?.length ? `${changes.length} competency ${changes.length === 1 ? "mark" : "marks"} updated` : event.title;
    if (brief) {
      const change = changes?.length === 1 ? changes[0] : null;
      const label = change ? `${change.name}: ${mark(change.after)}` : event.kind === "attendance" && event.evidence?.after ? `Attendance: ${mark(event.evidence.after)}` : title;
      return <li key={event.id} className={styles.briefEvent}>
        <time dateTime={event.date}>{formatDate(parseDateOnly(event.date))}</time>
        <Icon aria-hidden="true" className="size-5" />
        <div className="min-w-0"><p className="text-sm font-semibold [overflow-wrap:anywhere]">{label}</p><p className="pc-row-hint">{change ? `${mark(change.before)} → ${mark(change.after)} · ` : ""}{event.actor ?? "Saved record"}</p></div>
        {change && showCompetencyLinks ? <CompetencyHistory studentId={studentId} id={change.competencyId} name={change.name} /> : null}
      </li>;
    }
    return <li key={event.id} className="pc-row flex-nowrap">
      <Icon className="mt-1 size-4 shrink-0 self-start text-ui-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1"><p className="font-semibold [overflow-wrap:anywhere]">{title}</p><time dateTime={event.date} className="pc-row-hint">{formatDate(parseDateOnly(event.date))}</time></div>
        {changes?.map(change => <div key={change.competencyId} className="flex flex-wrap items-center justify-between gap-2 py-1"><div className="min-w-0 text-sm"><p>{change.name}</p><p className="text-ui-muted-foreground">{mark(change.before)} → {mark(change.after)}</p></div>{showCompetencyLinks ? <CompetencyHistory studentId={studentId} id={change.competencyId} name={change.name} /> : null}</div>)}
        {event.evidence && "after" in event.evidence ? <p className="text-sm">{"before" in event.evidence ? `${mark(event.evidence.before)} → ` : ""}{mark(event.evidence.after)}</p> : null}
        {event.className || event.site ? <p className="text-xs text-ui-muted-foreground">{[event.className, event.site].filter(Boolean).join(" · ")}</p> : null}
        {event.evidence?.note ? <p className="whitespace-pre-wrap text-sm">{event.evidence.note}</p> : null}
        {event.evidence && "previousNote" in event.evidence && event.evidence.previousNote !== event.evidence.note ? <p className="text-xs text-ui-muted-foreground">Note changed: {event.evidence.previousNote || "None"} → {event.evidence.note || "Cleared"}</p> : null}
        <p className="text-xs text-ui-muted-foreground">{event.actor ? `${event.actor} · ` : ""}{event.snapshot ? "Saved record" : "Recorded"} {formatDateTime(new Date(event.at))}</p>
        {event.snapshot ? <p className="text-xs text-ui-muted-foreground">Latest record · earlier changes unavailable</p> : null}
      </div>
    </li>;
  })}</ol>;
}

export function HistoryFeed({ studentId, query = {}, initial, compact = false, footer, emptyTitle }: { studentId: string; query?: HistoryQuery; initial?: HistoryPage; compact?: boolean; footer?: React.ReactNode; emptyTitle?: string }) {
  return <HistoryFeedPage key={`${studentId}:${JSON.stringify(query)}:${compact}`} studentId={studentId} query={query} initial={initial} compact={compact} footer={footer} emptyTitle={emptyTitle} />;
}

function HistoryFeedPage({ studentId, query, initial, compact, footer, emptyTitle = "No recorded activity matches this view" }: { studentId: string; query: HistoryQuery; initial?: HistoryPage; compact: boolean; footer?: React.ReactNode; emptyTitle?: string }) {
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
    {events.length ? <HistoryRows events={events} studentId={studentId} showCompetencyLinks={!query.competencyId} brief={!expanded} /> : !pending && !error ? <EmptyState compact title={emptyTitle} /> : null}
    {pending ? <p role="status" className="flex items-center gap-2 py-3 text-sm"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Loading history…</p> : null}
    {error ? <Notice tone="error" live="alert" title={error} actions={<Button variant="outline" disabled={pending} onClick={() => more(!page)}>Try again</Button>} /> : null}
    <div className="flex flex-wrap items-center gap-2">{!expanded && page?.events.length ? <Button variant="ghost" onClick={() => setExpanded(true)}>Show all class activity</Button> : expanded && page?.next ? <Button variant="outline" disabled={pending} onClick={() => more()}>Load earlier activity</Button> : null}{footer}</div>
  </div>;
}
