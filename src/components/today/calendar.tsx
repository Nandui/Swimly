"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, CheckCircle2, CircleX, List, Loader2, Table2, Users, RefreshCw } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Badge } from "@/components/shadcn/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/shadcn/empty";
import { Item } from "@/components/shadcn/item";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shadcn/tabs";
import { capacityLabel, capacityTone, courseName, formatTime, placesLeft } from "@/lib/courses/constants";
import { formatDate, minutesNow, parseDateOnly, today } from "@/lib/format";
import { CALENDAR_PHASE_META, calendarAgendaSlots, calendarAssessmentHref, calendarClassHref, calendarProgrammes, calendarSlots, classPhase, type CalendarAssessment, type CalendarClass } from "@/lib/today/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { ScheduleDayNavigation } from "./day-navigation";
import { scheduleHref, scheduleNow } from "@/lib/schedule/dates";
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
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-2xl font-semibold tracking-tight">Schedule</h1><p className="mt-1 text-sm text-ui-muted-foreground">{`${new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" }).format(parseDateOnly(iso))}, ${formatDate(parseDateOnly(iso))} · ${clubName}`}</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" className="min-h-11" onClick={refresh} disabled={refreshing} aria-busy={refreshing}>{refreshing ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}Refresh</Button>
        {target && isToday ? <Button className="min-h-11" onClick={jump}>{running ? "Jump to now" : "Jump to next"}</Button> : null}
      </div>
    </header>
    <ScheduleDayNavigation iso={iso} todayIso={clock.date} pending={refreshing} onSelect={date => startRefresh(() => router.push(scheduleHref(date), { scroll: false }))} />
    <span className="sr-only" role="status">{refreshing ? "Loading schedule" : `Showing ${formatDate(parseDateOnly(iso))}`}</span>
    <div inert={refreshing || undefined} className={refreshing ? "opacity-60" : undefined}>
    <Tabs value={agenda ? 'agenda' : 'sheet'} onValueChange={next => setView(next as 'sheet' | 'agenda')} className="gap-4">

    <section className={styles["sheet-toolbar"]} aria-label="Schedule display">
      <div className={styles["sheet-summary"]} role="status" aria-live="polite">
        <strong>{courses.length} {courses.length === 1 ? "class" : "classes"}</strong>
        {assessments.length > 0 ? <strong>{assessments.length} {assessments.length === 1 ? "assessment" : "assessments"}</strong> : null}
        {running > 0 ? <Badge variant="secondary" data-tone={CALENDAR_PHASE_META.running.color}>{`${running} running now`}</Badge> : null}
        {isToday && later > 0 ? <span>{later} upcoming</span> : null}
      </div>
      <TabsList aria-label="Calendar display" className={width < 600 ? "hidden" : "group-data-[orientation=horizontal]/tabs:h-auto"}>
        <TabsTrigger value="sheet" className="min-h-11" disabled={courses.length === 0 && assessments.length > 0}><Table2 aria-hidden="true" />Booking sheet</TabsTrigger>
        <TabsTrigger ref={agendaTrigger} value="agenda" className="min-h-11"><List aria-hidden="true" />Agenda</TabsTrigger>
      </TabsList>
    </section>

    {courses.length === 0 && assessments.length > 0 && width >= 600 ? <p className="text-sm text-ui-muted-foreground">Assessment sessions appear in Agenda. The booking sheet shows weekly classes.</p> : null}

    {(courses.length > 0 || assessments.length > 0) ? <div className={styles["sheet-legend"]} aria-label="Availability">
        <span><CheckCircle2 aria-hidden="true" />Spaces available</span>
        <span><CircleX aria-hidden="true" />Full</span>
    </div> : null}

    {!agenda && assessments.length > 0 ? <div className="flex flex-wrap items-center justify-between gap-2 rounded-ui-lg border border-ui-border bg-ui-muted/40 px-4 py-3">
      <p className="text-sm">{assessments.length} {assessments.length === 1 ? "assessment is" : "assessments are"} also scheduled on this day.</p>
      <Button variant="outline" className="min-h-11" onClick={() => { setView('agenda'); agendaTrigger.current?.focus(); }}><List aria-hidden="true" />View in agenda</Button>
    </div> : null}

    <TabsContent value={agenda ? 'agenda' : 'sheet'} className="m-0 min-w-0" tabIndex={-1}>
    {courses.length === 0 && assessments.length === 0 ? <CalendarEmpty />
        : agenda ? <section className={styles["agenda"]} aria-label="Schedule agenda">
          {agendaSlots.map(slot => <section key={slot.start} aria-labelledby={`time-${slot.start}`}>
            <header className={styles["agenda-time"]}><TimeHeading slot={slot} /><span className="text-sm text-ui-muted-foreground">{slot.entries.length} {slot.entries.length === 1 ? 'session' : 'sessions'}</span></header>
            <ul className={styles["agenda-list"]}>{slot.entries.map(entry => <li key={`${entry.kind}-${entry.value.id}`}>{entry.kind === 'class'
              ? <Booking course={entry.value} now={now} iso={iso} access={access} agenda />
              : <AssessmentBooking assessment={entry.value} now={now} allowed={access.assessments} />}</li>)}</ul>
          </section>)}
        </section> : <section className={styles["sheet-scroll"]} aria-label="Schedule booking sheet. Scroll horizontally for more times." tabIndex={0}>
          <Table aria-label="Schedule booking sheet" containerClassName="overflow-visible" style={{ minWidth: 136 + slots.length * 144 }}>
            <colgroup><col />{slots.map(slot => <col key={slot.start} />)}</colgroup>
            <TableHeader><TableRow>
              <TableHead scope="col">Level / time</TableHead>
              {slots.map(slot => <TableHead key={slot.start} scope="col" id={`column-${slot.start}`} data-phase={slot.phase}>
                <TimeHeading slot={slot} /><span className={styles["sheet-time-count"]}>{slot.classes.length} {slot.classes.length === 1 ? 'class' : 'classes'}</span>
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
                    </ul> : <><span aria-hidden="true">—</span><span className={styles["sr-only"]}>No class</span></>}
                  </TableCell>;
                })}
              </TableRow>)}
            </TableBody>)}
          </Table>
        </section>}
    </TabsContent></Tabs></div>
  </section>;
}

function CalendarEmpty() {
  return <Empty className="border border-ui-border"><EmptyHeader><EmptyMedia variant="icon"><CalendarCheck aria-hidden="true" /></EmptyMedia><EmptyTitle>Nothing scheduled for this day</EmptyTitle><EmptyDescription>There are no classes or assessments scheduled at this pool on the selected day.</EmptyDescription></EmptyHeader></Empty>;
}

function TimeHeading({ slot }: { slot: Pick<Slot, "start" | "phase"> }) {
  return <div className={styles["sheet-time"]}>
    <h2 id={`time-${slot.start}`} tabIndex={-1}>{formatTime(slot.start)}</h2>
    {slot.phase === 'running' ? <Badge variant="secondary" data-tone={CALENDAR_PHASE_META.running.color}>Now</Badge> : slot.phase === 'next' ? <Badge variant="secondary" data-tone={CALENDAR_PHASE_META.next.color}>Next</Badge> : null}
  </div>;
}

function AssessmentBooking({ assessment, now, allowed }: { assessment: CalendarAssessment; now: number | null; allowed: boolean }) {
  const phase = classPhase(assessment, now);
  const href = calendarAssessmentHref(assessment.id, allowed);
  const name = assessment.typeName || 'Assessment session';
  const location = assessment.location || 'Location not set';
  const free = placesLeft(assessment.booked, assessment.capacity);
  const available = free === null || free > 0;
  const availability = available
    ? free === null ? 'Spaces available · uncapped' : `${free} ${free === 1 ? 'space' : 'spaces'} available`
    : 'Full · no spaces available';
  const AvailabilityIcon = available ? CheckCircle2 : CircleX;
  const bookedLabel = assessment.capacity === null ? `${assessment.booked} booked` : `${assessment.booked} of ${assessment.capacity} booked`;
  const content = <>
    <span className={styles["booking-status"]}><Badge variant="secondary">Assessment</Badge></span>
    <span className={styles["booking-title"]}><span>{name}</span><span className={styles["booking-availability"]} data-available={available} role="img" aria-label={availability} title={availability}><AvailabilityIcon aria-hidden="true" /></span></span>
    <span className={styles["booking-subtitle"]}>{assessment.programmeName} · {location}</span>
    <span className={styles["booking-subtitle"]}>{assessment.instructor?.name || 'No instructor assigned'}</span>
    <span className={styles["booking-time"]}>{formatTime(assessment.startMinutes)}–{formatTime(assessment.startMinutes + assessment.durationMinutes)}</span>
    <span className={styles["booking-capacity"]}>
      <span className={styles["booking-places"]} title={bookedLabel}><Users aria-hidden="true" /><span aria-hidden="true">{assessment.capacity === null ? assessment.booked : `${assessment.booked}/${assessment.capacity}`}</span><span className={styles["sr-only"]}>{bookedLabel}</span></span>
      <span className={styles["booking-free"]}>{assessment.capacity !== null && assessment.booked > assessment.capacity ? `${assessment.booked - assessment.capacity} over capacity` : free !== null ? `${free} free` : 'Uncapped'}</span>
    </span>
    {phase === 'running' ? <span className={styles["booking-status"]}><Badge variant="secondary" data-tone={CALENDAR_PHASE_META.running.color}>Running now</Badge></span> : null}
  </>;
  const label = `Assessment: ${name}, ${formatTime(assessment.startMinutes)}, ${location}, ${availability}`;
  return <Item asChild variant="outline" className={styles.booking} data-phase={phase}>{href ? <a href={href} aria-label={`Open ${label}`}>{content}</a> : <article aria-label={label}>{content}</article>}</Item>;
}

function Booking({ course, now, iso, access, agenda = false }: { course: CalendarClass; now: number | null; iso: string; access: Access; agenda?: boolean }) {
  if (course.cancellation) return <Item variant="outline" className={styles.booking}>
    <span className={styles["booking-title"]}>{agenda ? courseName(course) : course.location || "Pool"}</span>
    <span className={styles["booking-status"]}><Badge variant="secondary" data-tone={CALENDAR_PHASE_META.cancelled.color}>Cancelled</Badge></span>
    <span className={styles["booking-time"]}>{formatTime(course.startMinutes)}–{formatTime(course.startMinutes + course.durationMinutes)}</span>
    <span className="break-words text-xs text-ui-muted-foreground">{course.cancellation.reason}</span>
  </Item>;
  const phase = classPhase(course, now);
  const name = courseName(course);
  const href = calendarClassHref(course.id, iso, access);
  const tone = capacityTone(course.enrolled, course.capacity);
  const free = placesLeft(course.enrolled, course.capacity);
  // Null is uncapped in Swimly; full and over-capacity classes have no places.
  const available = free === null || free > 0;
  const availability = available
    ? free === null ? 'Spaces available · uncapped' : `${free} ${free === 1 ? 'space' : 'spaces'} available`
    : tone && course.capacity !== null && course.enrolled > course.capacity ? `Full · ${tone.label} capacity` : 'Full · no spaces available';
  const AvailabilityIcon = available ? CheckCircle2 : CircleX;
  const location = course.location || 'Location not set';
  const content = <>
    <span className={styles["booking-title"]}><span>{agenda ? name : location}</span>
      <span className={styles["booking-availability"]} data-available={available} role="img" aria-label={availability} title={availability}><AvailabilityIcon aria-hidden="true" /></span>
    </span>
    {agenda ? <span className={styles["booking-subtitle"]}>{location}</span> : name !== course.level.name ? <span className={styles["booking-subtitle"]}>{name}</span> : null}
    <span className={styles["booking-subtitle"]}>{course.cover ? course.cover.coverByName + (course.cover.coverById !== (course.cover.instructorId === undefined ? course.instructorId : course.cover.instructorId) ? ' · Cover' : '') : course.instructor?.name || 'No instructor assigned'}</span>
    <span className={styles["booking-time"]}>{formatTime(course.startMinutes)}–{formatTime(course.startMinutes + course.durationMinutes)}</span>
    <span className={styles["booking-capacity"]}>
      <span className={styles["booking-places"]} title={`${capacityLabel(course.enrolled, course.capacity)} swimmers`}><Users aria-hidden="true" /><span aria-hidden="true">{course.capacity === null ? course.enrolled : `${course.enrolled}/${course.capacity}`}</span><span className={styles["sr-only"]}>{capacityLabel(course.enrolled, course.capacity)} swimmers</span></span>
      <span className={styles["booking-free"]}>{course.capacity !== null && course.enrolled > course.capacity ? `${course.enrolled - course.capacity} over capacity` : free !== null ? `${free} free` : 'Uncapped'}</span>
    </span>
    {agenda && phase === 'running' ? <span className={styles["booking-status"]}><Badge variant="secondary" data-tone={CALENDAR_PHASE_META.running.color}>Running now</Badge></span> : null}
  </>;
  return <Item asChild variant="outline" className={styles.booking} data-phase={phase}>{href ? <a href={href} aria-label={`Open class: ${name}, ${formatTime(course.startMinutes)}, ${location}, ${availability}${phase === 'running' ? ', running now' : ''}`}>{content}</a>
    : <article aria-label={`${name}, ${formatTime(course.startMinutes)}, ${location}, ${availability}`}>{content}</article>}</Item>;
}
