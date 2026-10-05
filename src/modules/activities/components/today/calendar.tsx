"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, CircleX, Clock, Loader2, RefreshCw, type LucideIcon } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Tag } from "@/components/ui-kit/tag";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Notice } from "@/components/ui-kit/notice";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shadcn/tabs";
import { capacityTone, courseName, placesLeft } from "@/modules/activities/lib/courses/constants";
import { formatDay, formatTime, formatTimeRange, minutesNow, plural, today } from "@/lib/format";
import { HOME_SESSION_META } from "@/lib/home-meta";
import { cn } from "@/lib/utils";
import { SCHEDULE_SUMMARY_META, calendarAgendaSlots, calendarAssessmentHref, calendarClassHref, calendarProgrammes, calendarSlots, classPhase, sessionState, type CalendarAssessment, type CalendarClass } from "@/modules/activities/lib/today/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { ScheduleDayNavigation } from "./day-navigation";
import { scheduleHref, scheduleNow } from "@/modules/activities/lib/schedule/dates";
import styles from "./calendar.module.css";

// shadcn primitives compose the owner-approved booking sheet.

type Access = { attendance: boolean; courses: boolean; assessments: boolean };
type Slot = ReturnType<typeof calendarSlots>[number];

export function ScheduleCalendar({ courses, assessments, iso, todayIso, initialNow, clubName, access }: {
  courses: CalendarClass[]; assessments: CalendarAssessment[]; iso: string; todayIso: string; initialNow: number; clubName: string; access: Access;
}) {
  const router = useRouter();
  const [view, setView] = useState<'sheet' | 'agenda'>('sheet');
  const [clock, setClock] = useState({ date: todayIso, minutes: initialNow });
  const now = scheduleNow(iso, clock.date, clock.minutes);
  const isToday = iso === clock.date;
  const [refreshing, startRefresh] = useTransition();
  const surface = useRef<HTMLElement>(null);
  const agendaTrigger = useRef<HTMLButtonElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = surface.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const update = () => {
      if (document.visibilityState !== "visible") return;
      const instant = new Date();
      setClock({ date: today(instant), minutes: minutesNow(instant) });
      // Preserve an open filter picker while the clock continues to update.
      if (!document.querySelector('[role="listbox"]')) router.refresh();
    };
    const timer = window.setInterval(update, 60_000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [iso, router]);

  const agenda = width < 600 || view === 'agenda' || (courses.length === 0 && assessments.length > 0);
  const slots = calendarSlots(courses, now);
  const agendaSlots = calendarAgendaSlots(courses, assessments, now);
  const programmes = calendarProgrammes(courses);
  const visibleSessions = agenda ? [...courses, ...assessments] : courses;
  const visibleSlots = agenda ? agendaSlots : slots;
  const running = visibleSessions.filter(session => classPhase(session, now) === "running").length;
  const later = visibleSessions.filter(session => classPhase(session, now) === "later").length;
  const target = visibleSlots.find(slot => slot.phase === "running") ?? visibleSlots.find(slot => slot.phase === "next");
  const refresh = () => {
    const instant = new Date();
    setClock({ date: today(instant), minutes: minutesNow(instant) });
    startRefresh(() => router.refresh());
  };
  const jump = () => {
    if (!target) return;
    const heading = document.getElementById(`time-${target.start}`);
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({ block: "nearest", inline: "center", behavior: "instant" });
  };

  return <section ref={surface} className={styles.calendar} data-schedule-calendar aria-busy={refreshing}>
    <PageHeader title="Schedule" description={`${formatDay(iso)} · ${clubName}`} actions={<>
      <Button variant="outline" onClick={refresh} disabled={refreshing} aria-busy={refreshing}>{refreshing ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}Refresh</Button>
      {target && isToday ? <Button onClick={jump}><Clock aria-hidden="true" />{running ? "Jump to now" : "Jump to next"}</Button> : null}
    </>} />
    <span className="sr-only" role="status">{refreshing ? "Loading schedule" : `Showing ${formatDay(iso)}`}</span>
    <div className="pc-panel">
    <Tabs value={agenda ? 'agenda' : 'sheet'} onValueChange={next => setView(next as 'sheet' | 'agenda')} className="gap-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <ScheduleDayNavigation iso={iso} todayIso={clock.date} pending={refreshing} onSelect={date => startRefresh(() => router.push(scheduleHref(date), { scroll: false }))} />
      <TabsList aria-label="Calendar display" className={width < 600 ? "hidden" : undefined}>
        <TabsTrigger value="sheet" disabled={courses.length === 0 && assessments.length > 0}>Booking sheet</TabsTrigger>
        <TabsTrigger ref={agendaTrigger} value="agenda">Agenda</TabsTrigger>
      </TabsList>
    </div>
    <div inert={refreshing || undefined} className={cn("flex min-w-0 flex-col gap-4", refreshing && "opacity-60")}>

    <div className="flex flex-wrap items-center gap-2" role="status" aria-live="polite">
      <Tag meta={SCHEDULE_SUMMARY_META.classes} label={plural(courses.length, "class", "classes")} />
      {assessments.length > 0 ? <Tag meta={SCHEDULE_SUMMARY_META.assessments} label={plural(assessments.length, "assessment")} /> : null}
      {running > 0 ? <Tag meta={HOME_SESSION_META.now} label={`${running} running now`} /> : null}
      {isToday && later > 0 ? <Tag meta={SCHEDULE_SUMMARY_META.upcoming} label={`${later} coming up`} /> : null}
    </div>

    {courses.length === 0 && assessments.length > 0 && width >= 600 ? <Notice title="Assessment sessions appear in Agenda." description="The booking sheet shows weekly classes." /> : null}

    {!agenda && assessments.length > 0 ? <Notice title={`${plural(assessments.length, "assessment")} ${assessments.length === 1 ? "is" : "are"} also scheduled on this day.`}
      actions={<Button variant="outline" onClick={() => { setView('agenda'); agendaTrigger.current?.focus(); }}>View in agenda</Button>} /> : null}

    <TabsContent value={agenda ? 'agenda' : 'sheet'} className="m-0 min-w-0" tabIndex={-1}>
    {courses.length === 0 && assessments.length === 0 ? <CalendarEmpty />
        : agenda ? <section className={styles["agenda"]} aria-label="Schedule agenda">
          {agendaSlots.map(slot => <section key={slot.start} aria-labelledby={`time-${slot.start}`}>
            <header className={styles["agenda-time"]}><TimeHeading slot={slot} count={plural(slot.entries.length, "session")} /></header>
            <ul className={styles["agenda-list"]}>{slot.entries.map(entry => <li key={`${entry.kind}-${entry.value.id}`}>{entry.kind === 'class'
              ? <Booking course={entry.value} now={now} iso={iso} access={access} agenda />
              : <AssessmentBooking assessment={entry.value} now={now} allowed={access.assessments} />}</li>)}</ul>
          </section>)}
        </section> : <section className={styles["sheet-scroll"]} aria-label="Schedule booking sheet. Scroll horizontally for more times." tabIndex={0}>
          <Table aria-label="Schedule booking sheet" data-layout="grid" containerClassName="overflow-visible">
            <colgroup><col className={styles["level-col"]} />{slots.map(slot => <col key={slot.start} className={styles["time-col"]} />)}</colgroup>
            <TableHeader><TableRow>
              <TableHead scope="col">Level and time</TableHead>
              {slots.map(slot => <TableHead key={slot.start} scope="col" id={`column-${slot.start}`} data-phase={slot.phase}>
                <TimeHeading slot={slot} count={plural(slot.classes.length, "class", "classes")} />
              </TableHead>)}
            </TableRow></TableHeader>
            {programmes.map(({ programme, levels }) => <TableBody key={programme.id} aria-labelledby={`programme-${programme.id}`}>
              <TableRow className={styles["programme"]}><TableHead colSpan={slots.length + 1} scope="rowgroup">
                <div className={styles["programme-title"]}><h2 id={`programme-${programme.id}`}>{programme.name}</h2><small>{levels.length} {levels.length === 1 ? 'level' : 'levels'}</small></div>
              </TableHead></TableRow>
              {levels.map(({ level, starts }) => <TableRow key={level.id}>
                <TableHead scope="row" id={`level-${level.id}`}>
                  <span className={styles["level-name"]}>{level.name}</span>
                  <span className={styles["level-count"]}>{[...starts.values()].flat().length} {[...starts.values()].flat().length === 1 ? 'class' : 'classes'}</span>
                </TableHead>
                {slots.map(slot => {
                  const classes = starts.get(slot.start);
                  return <TableCell key={slot.start} headers={`level-${level.id} column-${slot.start}`} data-empty={!classes}>
                    {classes ? <ul className={styles["booking-list"]} aria-label={`${level.name}, ${formatTime(slot.start)}`}>
                      {classes.map(course => <li key={course.id}><Booking course={course} now={now} iso={iso} access={access} /></li>)}
                    </ul> : <><span aria-hidden="true">—</span><span className="sr-only">No class</span></>}
                  </TableCell>;
                })}
              </TableRow>)}
            </TableBody>)}
          </Table>
        </section>}
    </TabsContent></div></Tabs></div>
  </section>;
}

function CalendarEmpty() {
  return <EmptyState as="h2" icon="calendarCheck" title="Nothing scheduled for this day" hint="There are no classes or assessments scheduled at this pool on the selected day." />;
}

/** A start time with its count; the running start says "On now" (the session map's word) and the
 *  next start "Next", so the column needing attention is named, not only coloured. */
function TimeHeading({ slot, count }: { slot: Pick<Slot, "start" | "phase">; count: string }) {
  const lead = slot.phase === "running" ? `${HOME_SESSION_META.now.label} · ` : slot.phase === "next" ? "Next · " : "";
  return <div className={styles["sheet-time"]}>
    <h2 id={`time-${slot.start}`} tabIndex={-1}>{formatTime(slot.start)}</h2>
    <span className={styles["sheet-time-count"]}>{lead}{count}</span>
  </div>;
}

/** Places left as a block tag: "2 free" or "No limit" with a check, "Full" or "2 over" with a
 *  cross; `spoken` is the longer form for the accessible name and tooltip. */
function availability(taken: number, capacity: number | null) {
  const free = placesLeft(taken, capacity), over = capacityTone(taken, capacity);
  if (free === null) return { icon: CircleCheck, tag: "No limit", spoken: "Spaces available, no limit" };
  if (free > 0) return { icon: CircleCheck, tag: `${free} free`, spoken: `${plural(free, "space")} available` };
  if (over && capacity !== null && taken > capacity) return { icon: CircleX, tag: over.label, spoken: `Full, ${over.label} capacity` };
  return { icon: CircleX, tag: "Full", spoken: "Full, no spaces available" };
}

/** One time block: title, caption lines that take the block's own text colour, then its tags. */
function Block({ href, label, state, title, lines, tags }: {
  href?: string; label: string; state?: string; title: string; lines: string[]; tags: ReactNode;
}) {
  const content = <>
    <span className="pc-block-body"><span className="pc-block-title">{title}</span>{lines.map((line, index) => <span key={index} className="pc-block-hint">{line}</span>)}</span>
    <span className={styles["block-tags"]}>{tags}</span>
  </>;
  return href ? <a href={href} className="pc-block" data-state={state} aria-label={label}>{content}</a>
    : <article className="pc-block" data-state={state} aria-label={label}>{content}</article>;
}

function BlockTag({ icon: Icon, label, title }: { icon: LucideIcon; label: string; title?: string }) {
  return <span className="pc-block-tag" title={title}><Icon aria-hidden />{label}</span>;
}

function AssessmentBooking({ assessment, now, allowed }: { assessment: CalendarAssessment; now: number | null; allowed: boolean }) {
  const phase = classPhase(assessment, now);
  const href = calendarAssessmentHref(assessment.id, allowed);
  const name = assessment.typeName || 'Assessment session';
  const location = assessment.location || 'Location not set';
  const places = availability(assessment.booked, assessment.capacity);
  const booked = assessment.capacity === null ? `${assessment.booked} booked` : `${assessment.booked}/${assessment.capacity} booked`;
  const meta = HOME_SESSION_META.assessment;
  const label = `Assessment: ${name}, ${formatTime(assessment.startMinutes)}, ${location}, ${places.spoken}${phase === "running" ? ", running now" : ""}`;
  return <Block href={href} label={href ? `Open ${label}` : label} state="assessment" title={name}
    lines={[`${assessment.programmeName} · ${location}`, assessment.instructor?.name || 'No instructor assigned', `${formatTimeRange(assessment.startMinutes, assessment.startMinutes + assessment.durationMinutes)} · ${booked}`]}
    tags={<><BlockTag icon={meta.icon} label={meta.label} /><BlockTag icon={places.icon} label={places.tag} title={places.spoken} /></>} />;
}

function Booking({ course, now, iso, access, agenda = false }: { course: CalendarClass; now: number | null; iso: string; access: Access; agenda?: boolean }) {
  const name = courseName(course);
  const time = formatTimeRange(course.startMinutes, course.startMinutes + course.durationMinutes);
  const location = course.location || 'Location not set';
  // A declared substitute keeps the class's phase colour and reads "(cover)"; only a class nobody
  // is teaching takes the cover state, as on the home timeline.
  const teacher = course.cover?.coverByName ?? course.instructor?.name ?? null;
  const substitute = !!course.cover && course.cover.coverById !== (course.cover.instructorId === undefined ? course.instructorId : course.cover.instructorId);
  const who = teacher ? `${teacher}${substitute ? " (cover)" : ""}` : "No instructor";
  const state = sessionState({ ...course, instructor: teacher }, now);
  // A future day has no clock yet, so its classes are neutral blocks rather than "coming up".
  const shown = now === null && state === "next" ? undefined : state;
  const href = calendarClassHref(course.id, iso, access);
  const levelLine = !agenda && name !== course.level.name ? [name] : [];
  if (course.cancellation) {
    const off = HOME_SESSION_META.off;
    return <Block label={`${name}, ${time}, ${location}, ${off.label}`} state="off" title={agenda ? name : who}
      lines={[...levelLine, ...(agenda ? [who] : []), `${location} · ${course.cancellation.reason}`]} tags={<BlockTag icon={off.icon} label={off.label} />} />;
  }
  const places = availability(course.enrolled, course.capacity);
  const swimmers = course.capacity === null ? `${plural(course.enrolled, 'swimmer')} enrolled` : `${course.enrolled} of ${plural(course.capacity, 'swimmer')}`;
  const count = `${location} · ${course.capacity === null ? `${course.enrolled} enrolled` : `${course.enrolled}/${course.capacity}`}`;
  const label = `${name}, ${formatTime(course.startMinutes)}, ${location}, ${places.spoken}${state === "now" ? ", running now" : ""}`;
  return <Block href={href} label={href ? `Open class: ${label}` : label} state={shown} title={agenda ? name : who}
    lines={agenda ? [who, count, time] : [...levelLine, count]}
    tags={<BlockTag icon={places.icon} label={places.tag} title={`${swimmers}. ${places.spoken}`} />} />;
}
