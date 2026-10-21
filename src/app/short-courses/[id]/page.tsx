import type { Metadata } from "next";
import { Pencil } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { Tag } from "@/components/ui-kit/tag";
import {
  clock, CourseDialog, CourseStatusButton, euro, HEALTH_FORM_META, LinkPersonButton, newCourseOptions, PersonDialog, PlaceButton, RegisterDialog, SessionDialog,
  SHORT_COURSE_AREA_META, SHORT_COURSE_CALL_DUE_META, SHORT_COURSE_META, SHORT_COURSE_ONLINE_META, SHORT_COURSE_PAYMENT_META, SHORT_COURSE_PLACE_META, shortCourse, SWIMMER_RECORD_META,
  type ShortCourseArea, type ShortCoursePayment, type ShortCourseView,
} from "@/modules/short-courses/features/courses";
import { addDaysIso, formatDate, plural } from "@/lib/format";

export const metadata: Metadata = { title: "Short course" };

const day = (iso: string) => formatDate(new Date(`${iso}T00:00:00Z`));
type Person = ShortCourseView["booked"][number];

/** One short course (owner decision, 13 October 2026): its weekly sessions and registers, who is
 *  booked and what they owe, and the waiting list. View books people on, Instructor takes the
 *  registers, Manage puts the course on and moves its sessions. */
export default async function ShortCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { course, booked, waiting, withdrawn, canRun, canManage, areas, today, swimmerRecords, canOpenSwimmers } = await shortCourse(id);
  const options = canManage ? await newCourseOptions() : null;
  const area = SHORT_COURSE_AREA_META[course.type.area as ShortCourseArea] ?? SHORT_COURSE_AREA_META.other;
  const closed = course.state === "cancelled" || course.state === "finished";
  const full = course.taken >= course.capacity;
  const free = course.capacity - course.taken;
  const owed = booked.reduce((n, p) => n + p.owed, 0);
  const dates = course.first ? (course.last && course.last !== course.first ? `${day(course.first)} to ${day(course.last)}` : day(course.first)) : "no sessions yet";
  const lastSession = course.sessions[course.sessions.length - 1];
  const nextWeek = lastSession ? { date: addDaysIso(lastSession.date, 7),
    startMinutes: lastSession.startMinutes, endMinutes: lastSession.endMinutes, place: lastSession.place } : undefined;
  const personDialog = (p?: Person) => (
    <PersonDialog courseId={course.id} priceCents={course.priceCents} full={full} healthForm={course.type.healthForm} minAge={course.type.minAge}
      swimmerRecords={swimmerRecords} canOpenSwimmers={canOpenSwimmers} person={p} trigger={p ? <Button variant="outline" size="icon" aria-label={`Change ${p.name}`}><Pencil aria-hidden="true" /></Button> : undefined} />
  );
  /** Member number first, then how to reach them: from their swimmer record when linked. */
  const reach = (p: Person) => [p.swimmer?.memberNumber ? `Member ${p.swimmer.memberNumber}` : null, p.swimmer?.contactPhone || p.phone || p.swimmer?.contactEmail || p.email || null];
  /** The swimmer record's tags: medical notes on file, or not linked yet (with the button to link). */
  const recordTags = (p: Person) => <>
    {p.swimmer?.hasMedicalNotes ? <Tag meta={SWIMMER_RECORD_META.medical} /> : null}
    {swimmerRecords && !p.swimmerId ? <Tag meta={SWIMMER_RECORD_META.unlinked} /> : null}
  </>;
  const linkButton = (p: Person) => swimmerRecords && !p.swimmerId && !closed
    ? <LinkPersonButton id={p.id} name={p.name} email={p.email} phone={p.phone} dateOfBirth={p.dateOfBirth} minAge={course.type.minAge} /> : null;
  const facts: [string, string][] = [
    ["Instructor", course.instructor.name],
    ["Places", `${course.taken} of ${course.capacity} booked${waiting.length ? `, ${waiting.length} waiting` : ""}`],
    ["Price", course.priceCents ? euro(course.priceCents) : "No charge"],
    ["Sessions", `${course.held} of ${course.sessions.length} held`],
    ["Still to pay", owed ? euro(owed) : "Nothing"],
    ["Who it is for", course.type.minAge ? `${course.type.minAge} and over` : "Any age"],
    ["Health form", course.type.healthForm ? "Asked for" : "Not asked for"],
    ...(course.type.area === "pool" ? [["Parents app", course.bookOnline ? "Shown until the first session" : "Not shown"] as [string, string]] : []),
  ];
  return (
    <PageShell spacing="roomy" header={<PageHeader back={{ href: "/short-courses", label: "Courses" }} title={course.type.name} description={`${course.site.name} · ${dates}`}
        status={<><Tag meta={SHORT_COURSE_META[course.state]} /><Tag meta={area} /></>}
        actions={canManage ? <>
          {options && !closed ? <CourseDialog course={{ id: course.id, siteId: course.siteId, typeId: course.typeId, capacity: course.capacity, priceCents: course.priceCents, instructorId: course.instructorId, note: course.note, bookOnline: course.bookOnline }}
            sites={[{ id: course.siteId, name: course.site.name }]} types={[{ id: course.typeId, name: course.type.name, area: course.type.area, weeks: course.sessions.length, sessionMinutes: 60 }]}
            perSite={options.perSite.some((s) => s.siteId === course.siteId) ? options.perSite : [{ siteId: course.siteId, people: [], areas }]} today={today}
            trigger={<Button variant="outline"><Pencil aria-hidden="true" />Change</Button>} /> : null}
          {!closed ? <CourseStatusButton id={course.id} to="finished" label="Finish" title="Mark the course finished?" description="It moves to finished courses. Registers and payments stay on the record." /> : null}
          {!closed ? <CourseStatusButton id={course.id} to="cancelled" label="Cancel course" title="Cancel this course?" description="Its sessions leave the Rota. People and their payments stay on the record; refunds are handled at the till." destructive /> : null}
          {closed ? <CourseStatusButton id={course.id} to="planned" label="Reopen" title="Reopen this course?" description="It goes back on, and its sessions back on the Rota." /> : null}
        </> : undefined} />}>

      <section className="pc-panel" aria-labelledby="sc-facts">
        <div className="pc-panel-head"><h2 id="sc-facts">About the course</h2></div>
        <dl className="grid gap-4 grid-cols-tiles">
          {facts.map(([label, value]) => (
            <div key={label} className="min-w-0"><dt className="text-xs font-semibold text-ui-muted-foreground">{label}</dt><dd className="mt-1 wrap-anywhere">{value}</dd></div>
          ))}
        </dl>
        {course.type.description ? <p className="text-sm text-ui-muted-foreground">{course.type.description}</p> : null}
        {course.note ? <p className="text-sm">{course.note}</p> : null}
      </section>

      <section className="pc-panel" aria-labelledby="sc-people">
        <div className="pc-panel-head">
          <div className="flex flex-col gap-1"><h2 id="sc-people">Booked · {course.taken} of {course.capacity}</h2>
            <p className="pc-row-hint">Payment is taken at the till and recorded here.</p></div>
          {!closed ? personDialog() : null}
        </div>
        {booked.length === 0 ? <EmptyState compact icon="users" title="Nobody booked yet" hint={!closed ? "Book each person on with their payment." : undefined} /> : (
          <ul className="pc-rows">
            {booked.map((p) => (
              <li key={p.id} className="pc-row">
                <span className="pc-row-body">
                  <span className="pc-row-title">{p.name}</span>
                  <span className="pc-row-hint">{[...reach(p), p.online?.phone2 || null, course.held ? `at ${p.attended} of ${course.held}` : null,
                    p.owed ? `${euro(p.owed)} to pay` : p.paidCents ? `${euro(p.paidCents)} paid` : null, p.online?.reference ?? null,
                    p.online?.call ? `${p.online.call.due === "overdue" ? p.online.call.label : `phone by ${p.online.call.label}`}${p.online.callTimes.length ? `, best ${p.online.callTimes.join(", ").toLowerCase()}` : ""}` : null,
                    p.note || null].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="pc-row-trail flex-wrap">
                  {p.online?.call ? <Tag meta={SHORT_COURSE_CALL_DUE_META[p.online.call.due]} /> : p.online ? <Tag meta={SHORT_COURSE_ONLINE_META.online} /> : null}
                  {recordTags(p)}
                  {course.type.healthForm && !p.healthFormOn ? <Tag meta={HEALTH_FORM_META.missing} /> : null}
                  <Tag meta={SHORT_COURSE_PAYMENT_META[p.payment as ShortCoursePayment] ?? SHORT_COURSE_PAYMENT_META.owed} />
                  {linkButton(p)}
                  {personDialog(p)}
                  {!closed ? <PlaceButton id={p.id} name={p.name} to="withdrawn" label="Withdraw" destructive title={`Withdraw ${p.name}?`}
                    description={waiting.length ? `Their place is freed for ${waiting[0].name}, first on the waiting list.` : "Their place is freed. Their record and register marks stay."} /> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {waiting.length ? (
        <section className="pc-panel" aria-labelledby="sc-waiting">
          <div className="pc-panel-head">
            <div className="flex flex-col gap-1"><h2 id="sc-waiting">Waiting list · {waiting.length}</h2>
              <p className="pc-row-hint">{free > 0 ? `${plural(free, "place")} free. Offer it to whoever is first, then give them the place.` : "In the order they were added. A place is offered when someone withdraws."}</p></div>
          </div>
          <ul className="pc-rows">
            {waiting.map((p, i) => (
              <li key={p.id} className="pc-row">
                <span className="pc-row-body">
                  <span className="pc-row-title">{i + 1}. {p.name}</span>
                  <span className="pc-row-hint">{[...reach(p), p.online?.phone2 || null, `added ${formatDate(p.createdAt)}`, p.online?.reference ?? null, p.note || null].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="pc-row-trail flex-wrap">
                  {p.online ? <Tag meta={SHORT_COURSE_ONLINE_META.online} /> : null}
                  {recordTags(p)}
                  <Tag meta={SHORT_COURSE_PLACE_META.waiting} />
                  {linkButton(p)}
                  {personDialog(p)}
                  {!closed && free > 0 ? <PlaceButton id={p.id} name={p.name} to="booked" label="Give the place" primary={i === 0} title={`Give ${p.name} a place?`} description="They are booked on. Record their payment next." /> : null}
                  {!closed ? <PlaceButton id={p.id} name={p.name} to="withdrawn" label="Remove" destructive title={`Take ${p.name} off the waiting list?`} description="They stay on the record as withdrawn." /> : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="pc-panel" aria-labelledby="sc-sessions">
        <div className="pc-panel-head">
          <div className="flex flex-col gap-1"><h2 id="sc-sessions">Sessions</h2><p className="pc-row-hint">Each shows on the Rota in its area for the instructor. Move a week here when it changes.</p></div>
          {canManage && !closed ? <SessionDialog courseId={course.id} areas={areas} suggest={nextWeek} /> : null}
        </div>
        {course.sessions.length === 0 ? <EmptyState compact icon="calendarDays" title="No sessions" hint={canManage ? "Add a session for each week." : undefined} /> : (
          <ul className="pc-rows">
            {course.sessions.map((s, i) => {
              const marks = Object.fromEntries(s.attendance.map((a) => [a.participantId, a.present]));
              const there = s.attendance.filter((a) => a.present).length;
              return (
                <li key={s.id} className="pc-row">
                  <span className="pc-row-body">
                    <span className="pc-row-title tabular-nums">Week {i + 1}: {day(s.date)}, {clock(s.startMinutes)} to {clock(s.endMinutes)}</span>
                    <span className="pc-row-hint">{[s.place || "No area", s.note || null, s.registerAt ? `register by ${s.registerBy}: ${there} there` : s.date <= today ? "register not taken" : null].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="pc-row-trail">
                    {canRun && !closed && s.date <= today ? <RegisterDialog session={{ id: s.id, label: day(s.date), marks, taken: !!s.registerAt }} people={booked.map((p) => ({ id: p.id, name: p.name, memberNumber: p.swimmer?.memberNumber, medical: p.swimmer?.hasMedicalNotes }))} /> : null}
                    {canManage && !closed ? <SessionDialog courseId={course.id} areas={areas} session={{ id: s.id, date: s.date, startMinutes: s.startMinutes, endMinutes: s.endMinutes, place: s.place, note: s.note }}
                      trigger={<Button variant="outline" size="icon" aria-label={`Change the session on ${day(s.date)}`}><Pencil aria-hidden="true" /></Button>} /> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {withdrawn.length ? (
        <section className="pc-panel" aria-labelledby="sc-withdrawn">
          <div className="pc-panel-head"><h2 id="sc-withdrawn">Withdrawn · {withdrawn.length}</h2></div>
          <ul className="pc-rows">
            {withdrawn.map((p) => (
              <li key={p.id} className="pc-row" data-muted="">
                <span className="pc-row-body">
                  <span className="pc-row-title">{p.name}</span>
                  <span className="pc-row-hint">{[...reach(p), p.paidCents ? `${euro(p.paidCents)} paid` : null].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="pc-row-trail flex-wrap">
                  <Tag meta={SHORT_COURSE_PLACE_META.withdrawn} />
                  {!closed ? <PlaceButton id={p.id} name={p.name} to={full ? "waiting" : "booked"} label={full ? "Back on the waiting list" : "Put back"}
                    title={full ? `Put ${p.name} back on the waiting list?` : `Put ${p.name} back on?`} description={full ? "The course is full. They go back in the order they were first added." : "They take a place again."} /> : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </PageShell>
  );
}
