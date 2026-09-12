"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, CheckCircle2, CircleX, List, Loader2, Table2, Users, RefreshCw } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Badge } from "@/components/shadcn/badge";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/shadcn/empty";
import { Item } from "@/components/shadcn/item";
import { Label } from "@/components/shadcn/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shadcn/tabs";
import { capacityLabel, capacityTone, courseName, formatTime, placesLeft } from "@/lib/courses/constants";
import { formatDate, minutesNow, parseDateOnly, today } from "@/lib/format";
import { CALENDAR_PHASE_META, calendarAgendaSlots, calendarAssessmentHref, calendarClassHref, calendarProgrammes, calendarSlots, classPhase, filterCalendarAssessments, filterCalendarClasses, type CalendarAssessment, type CalendarClass } from "@/lib/today/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { InstructorPicker } from "./instructor-picker";
import styles from "./calendar.module.css";

// shadcn primitives compose the owner-approved booking sheet.

type Access = { attendance: boolean; courses: boolean; assessments: boolean };
type Slot = ReturnType<typeof calendarSlots>[number];

export function TodayCalendar({ courses, assessments, iso, initialNow, clubName, me, access }: {
  courses: CalendarClass[]; assessments: CalendarAssessment[]; iso: string; initialNow: number; clubName: string; me: string; access: Access;
}) {
  const router = useRouter();
  const poolId = useId();
  const [location, setLocation] = useState("all");
  const [instructor, setInstructor] = useState("all");
  const [view, setView] = useState<'sheet' | 'agenda'>('sheet');
  const [now, setNow] = useState(initialNow);
  const [dateChanged, setDateChanged] = useState(false);
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
      setNow(minutesNow(instant));
      setDateChanged(today(instant) !== iso);
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

  const shown = filterCalendarClasses(courses, location, instructor, me);
  const shownAssessments = filterCalendarAssessments(assessments, location, instructor, me);
  const agenda = width < 600 || view === 'agenda' || (shown.length === 0 && shownAssessments.length > 0);
  const slots = calendarSlots(shown, now);
  const agendaSlots = calendarAgendaSlots(shown, shownAssessments, now);
  const programmes = calendarProgrammes(shown);
  const visibleSessions = agenda ? [...shown, ...shownAssessments] : shown;
  const visibleSlots = agenda ? agendaSlots : slots;
  const running = visibleSessions.filter(session => classPhase(session, now) === "running").length;
  const later = visibleSessions.filter(session => classPhase(session, now) === "later").length;
  const target = visibleSlots.find(slot => slot.phase === "running") ?? visibleSlots.find(slot => slot.phase === "next");
  const locations = [...new Set([...courses, ...assessments].map(session => session.location ?? ""))].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  const people = new Map<string, string>();
  for (const course of courses) {
    if (course.instructor) people.set(course.instructor.id, course.instructor.name);
    if (course.cover?.coverById) people.set(course.cover.coverById, course.cover.coverByName);
  }
  for (const assessment of assessments) {
    if (assessment.instructor) people.set(assessment.instructor.id, assessment.instructor.name);
  }
  const filtered = location !== "all" || instructor !== "all";
  const reset = () => { setLocation("all"); setInstructor("all"); };
  const refresh = () => {
    const instant = new Date();
    setNow(minutesNow(instant));
    setDateChanged(today(instant) !== iso);
    startRefresh(() => router.refresh());
  };
  const jump = () => {
    if (!target) return;
    const heading = document.getElementById(`time-${target.start}`);
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({ block: "nearest", inline: "center", behavior: "instant" });
  };

  return <section ref={surface} className={styles.calendar} data-today-calendar>
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-2xl font-semibold tracking-tight">Today’s schedule</h1><p className="mt-1 text-sm text-ui-muted-foreground">{`${new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" }).format(parseDateOnly(iso))}, ${formatDate(parseDateOnly(iso))} · ${clubName}`}</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={refresh} disabled={refreshing} aria-busy={refreshing}>{refreshing ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}Refresh</Button>
        {target && !dateChanged ? <Button onClick={jump}>{running ? "Jump to now" : "Jump to next"}</Button> : null}
      </div>
    </header>
    <Tabs value={agenda ? 'agenda' : 'sheet'} onValueChange={next => setView(next as 'sheet' | 'agenda')} className="gap-4">

    <section className={styles["sheet-toolbar"]} aria-label="Calendar controls">
      <div className={styles["sheet-filters"]}>
        <div className="flex min-w-0 flex-col gap-2 sm:w-48"><Label htmlFor={poolId}>Pool area</Label>
          <Select value={location || '__unset__'} onValueChange={value => setLocation(value === '__unset__' ? '' : value)}><SelectTrigger id={poolId} className="w-full"><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="all">All pool areas</SelectItem>{locations.map(value => <SelectItem key={value} value={value || '__unset__'}>{value || 'Location not set'}</SelectItem>)}
          </SelectContent></Select>
        </div>
        <InstructorPicker value={instructor} onChange={setInstructor} options={[{ value: "all", label: "All instructors" }, { value: "mine", label: "My schedule" }, ...[...people].sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ value, label }))]} />
        {filtered ? <Button variant="ghost" onClick={reset}>Clear filters</Button> : null}
      </div>
      <TabsList aria-label="Calendar display" className={width < 600 ? "hidden" : ""}>
        <TabsTrigger value="sheet" disabled={shown.length === 0 && shownAssessments.length > 0}><Table2 aria-hidden="true" />Booking sheet</TabsTrigger>
        <TabsTrigger ref={agendaTrigger} value="agenda"><List aria-hidden="true" />Agenda</TabsTrigger>
      </TabsList>
    </section>

    {!dateChanged && (shown.length > 0 || shownAssessments.length > 0) ? <div className={styles["sheet-meta"]}>
      <div className={styles["sheet-summary"]} role="status" aria-live="polite">
        <strong>{filtered ? `${shown.length} of ${courses.length}` : courses.length} {courses.length === 1 ? "class" : "classes"}</strong>
        {assessments.length > 0 ? <strong>{filtered ? `${shownAssessments.length} of ${assessments.length}` : assessments.length} {assessments.length === 1 ? "assessment" : "assessments"}</strong> : null}
        {running > 0 ? <Badge variant="secondary" data-tone={CALENDAR_PHASE_META.running.color}>{`${running} running now`}</Badge> : null}
        {later > 0 ? <span>{later} upcoming</span> : null}
      </div>
      <div className={styles["sheet-legend"]} aria-label="Availability">
        <span><CheckCircle2 aria-hidden="true" />Spaces available</span>
        <span><CircleX aria-hidden="true" />Full</span>
      </div>
    </div> : null}

    {!agenda && !dateChanged && shownAssessments.length > 0 ? <div className="flex flex-wrap items-center justify-between gap-2 rounded-ui-lg border border-ui-border bg-ui-muted/40 px-4 py-3">
      <p className="text-sm">{shownAssessments.length} {shownAssessments.length === 1 ? "assessment is" : "assessments are"} also scheduled today.</p>
      <Button variant="outline" onClick={() => { setView('agenda'); agendaTrigger.current?.focus(); }}><List aria-hidden="true" />View in agenda</Button>
    </div> : null}

    <TabsContent value={agenda ? 'agenda' : 'sheet'} className="m-0 min-w-0" tabIndex={-1}>
    {dateChanged ? <CalendarEmpty title="A new day has started" hint="Refresh to load today’s schedule." action={<Button onClick={refresh} disabled={refreshing}>Load today</Button>} />
      : shown.length === 0 && shownAssessments.length === 0 ? <CalendarEmpty title={courses.length || assessments.length ? "No sessions match these filters" : "Nothing scheduled today"}
        hint={courses.length || assessments.length ? "Clear the filters to see the full day." : "There are no classes or assessments scheduled at this pool today."}
        action={filtered ? <Button onClick={reset}>Show full schedule</Button> : undefined} />
        : agenda ? <section className={styles["agenda"]} aria-label="Today’s agenda">
          {agendaSlots.map(slot => <section key={slot.start} aria-labelledby={`time-${slot.start}`}>
            <header className={styles["agenda-time"]}><TimeHeading slot={slot} /><span className="text-sm text-ui-muted-foreground">{slot.entries.length} {slot.entries.length === 1 ? 'session' : 'sessions'}</span></header>
            <ul className={styles["agenda-list"]}>{slot.entries.map(entry => <li key={`${entry.kind}-${entry.value.id}`}>{entry.kind === 'class'
              ? <Booking course={entry.value} now={now} iso={iso} access={access} agenda />
              : <AssessmentBooking assessment={entry.value} now={now} allowed={access.assessments} />}</li>)}</ul>
          </section>)}
        </section> : <section className={styles["sheet-scroll"]} aria-label="Today’s booking sheet. Scroll for more times and levels." tabIndex={0}>
          <Table aria-label="Today’s booking sheet" containerClassName="overflow-visible" style={{ minWidth: 136 + slots.length * 144 }}>
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
    </TabsContent></Tabs>
  </section>;
}

function CalendarEmpty({ title, hint, action }: { title: string; hint: string; action?: React.ReactNode }) {
  return <Empty className="border border-ui-border"><EmptyHeader><EmptyMedia variant="icon"><CalendarCheck aria-hidden="true" /></EmptyMedia><EmptyTitle>{title}</EmptyTitle><EmptyDescription>{hint}</EmptyDescription></EmptyHeader>{action ? <EmptyContent>{action}</EmptyContent> : null}</Empty>;
}

function TimeHeading({ slot }: { slot: Pick<Slot, "start" | "phase"> }) {
  return <div className={styles["sheet-time"]}>
    <h2 id={`time-${slot.start}`} tabIndex={-1}>{formatTime(slot.start)}</h2>
    {slot.phase === 'running' ? <Badge variant="secondary" data-tone={CALENDAR_PHASE_META.running.color}>Now</Badge> : slot.phase === 'next' ? <Badge variant="secondary" data-tone={CALENDAR_PHASE_META.next.color}>Next</Badge> : null}
  </div>;
}

function AssessmentBooking({ assessment, now, allowed }: { assessment: CalendarAssessment; now: number; allowed: boolean }) {
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

function Booking({ course, now, iso, access, agenda = false }: { course: CalendarClass; now: number; iso: string; access: Access; agenda?: boolean }) {
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
  return <Item asChild variant="outline" className={styles.booking} data-phase={phase}>{href ? <a href={href} aria-label={`${access.attendance ? 'Open attendance' : 'Open class'}: ${name}, ${formatTime(course.startMinutes)}, ${location}, ${availability}${phase === 'running' ? ', running now' : ''}`}>{content}</a>
    : <article aria-label={`${name}, ${formatTime(course.startMinutes)}, ${location}, ${availability}`}>{content}</article>}</Item>;
}
