import type { Metadata } from "next";
import { Pencil } from "lucide-react";
import { BackLink } from "@/components/ui-kit/back-link";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Notice } from "@/components/ui-kit/notice";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { CallDialog } from "@/modules/academy/features/calls";
import {
  academyCourse, ACADEMY_CALL_DUE_META, ACADEMY_COURSE_META, ACADEMY_KIND_META, ACADEMY_PAYMENT_META, ACADEMY_RESULT_META, callDue, CandidateDialog, ChecksDialog,
  CourseDialog, CourseStatusButton, euro, hoursLabel, newCourseOptions, RegisterDialog, ResultDialog, SessionDialog, WithdrawButton,
  type AcademyKind, type AcademyPayment, type AcademyResult,
} from "@/modules/academy/features/courses";
import { formatDate, formatDateTime, plural } from "@/lib/format";

export const metadata: Metadata = { title: "Academy course" };

const day = (iso: string) => formatDate(new Date(`${iso}T00:00:00Z`));
const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** One course (owner decision, 8 October 2026): its sessions and their registers, its candidates
 *  with payment, pre-course checks, hours and result. Tutor (Run) works the course; Manage puts
 *  it on and changes its sessions. */
export default async function AcademyCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { course, candidates, canRun, canManage, areas, staff, today } = await academyCourse(id);
  const options = canManage ? await newCourseOptions() : null;
  const kind = ACADEMY_KIND_META[course.type.kind as AcademyKind] ?? ACADEMY_KIND_META.other;
  const open = course.state !== "cancelled" && course.state !== "completed";
  const active = candidates.filter((c) => c.status !== "withdrawn");
  const owed = active.filter((c) => c.payment === "owed" || c.payment === "deposit").reduce((n, c) => n + Math.max(0, course.priceCents - c.paidCents), 0);
  const grants = course.type.qualificationType?.name ?? null;
  const dates = course.first ? (course.last && course.last !== course.first ? `${day(course.first)} to ${day(course.last)}` : day(course.first)) : "no sessions yet";
  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/academy" label="Courses" />
      <PageHeader title={course.type.name} description={`${course.site.name} · ${dates}`}
        status={<><Tag meta={ACADEMY_COURSE_META[course.state]} /><Tag meta={kind} /></>}
        actions={canManage ? <>
          {options && open ? <CourseDialog course={{ id: course.id, siteId: course.siteId, typeId: course.typeId, capacity: course.capacity, priceCents: course.priceCents, tutorId: course.tutorId, assessorId: course.assessorId, note: course.note, bookOnline: course.bookOnline }}
            sites={options.sites.length ? options.sites : [{ id: course.siteId, name: course.site.name }]} types={options.types} staff={options.staff}
            trigger={<Button variant="outline"><Pencil aria-hidden="true" />Change</Button>} /> : null}
          {open ? <CourseStatusButton id={course.id} to="completed" label="Complete" title="Mark the course completed?" description="Every candidate needs a result or to have withdrawn first." /> : null}
          {open ? <CourseStatusButton id={course.id} to="cancelled" label="Cancel course" title="Cancel this course?" description="Its sessions leave the Rota. Candidates and their payments stay on the record; refunds are handled where they paid." destructive /> : null}
          {!open ? <CourseStatusButton id={course.id} to="planned" label="Reopen" title="Reopen this course?" description="It goes back to planned, and its sessions to the Rota." /> : null}
        </> : undefined} />

      <section className="pc-panel" aria-labelledby="ac-facts">
        <div className="pc-panel-head"><h2 id="ac-facts">About the course</h2></div>
        <dl className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,var(--pc-tile-min)),1fr))]">
          {[
            ["Tutor", course.tutor.name],
            ["Assessor", course.assessor?.name ?? "The tutor"],
            ["Places", `${course.taken} of ${course.capacity} taken`],
            ["Price", course.priceCents ? euro(course.priceCents) : "No charge"],
            ["Hours", `${hoursLabel(course.hours)} planned${course.type.minHours ? `; ${course.type.minHours}h to attend` : ""}`],
            ["Awarding body", course.type.awardingBody || "Not set"],
            ["Staff who pass get", grants ?? "Nothing on their record"],
            ["Still to pay", owed ? euro(owed) : "Nothing"],
            ["Online booking", course.bookOnline ? (open && course.state === "planned" ? "Open until it starts" : "Closed") : "Not online"],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0"><dt className="text-xs font-semibold text-ui-muted-foreground">{label}</dt><dd className="mt-1 [overflow-wrap:anywhere]">{value}</dd></div>
          ))}
        </dl>
        {course.note ? <p className="text-sm">{course.note}</p> : null}
        {course.type.minHours && course.hours < course.type.minHours * 60 ? <Notice tone="warning" title="Not enough hours planned">{`The sessions add up to ${hoursLabel(course.hours)}; candidates need ${course.type.minHours} hours.`}</Notice> : null}
      </section>

      <section className="pc-panel" aria-labelledby="ac-sessions">
        <div className="pc-panel-head">
          <div className="flex flex-col gap-1"><h2 id="ac-sessions">Sessions</h2><p className="pc-row-hint">Each shows on the Rota in its area for the tutor and assessor.</p></div>
          {canManage && open ? <SessionDialog courseId={course.id} areas={areas} suggestDate={course.last ?? today} /> : null}
        </div>
        {course.sessions.length === 0 ? <EmptyState compact icon="calendarDays" title="No sessions yet" hint={canManage ? "Add each day of the course with its times and area." : undefined} /> : (
          <ul className="pc-rows">
            {course.sessions.map((s) => {
              const there = s.attendance.filter((a) => a.minutes > 0).length;
              const marks = Object.fromEntries(s.attendance.map((a) => [a.candidateId, a.minutes]));
              return (
                <li key={s.id} className="pc-row">
                  <span className="pc-row-body">
                    <span className="pc-row-title tabular-nums">{day(s.date)}, {clock(s.startMinutes)} to {clock(s.endMinutes)}</span>
                    <span className="pc-row-hint">{[s.place || "No area", s.note || null, s.registerAt ? `register by ${s.registerBy}: ${there} of ${s.attendance.length} there` : s.date <= today ? "register not taken" : null].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="pc-row-trail">
                    {canRun && open && s.date <= today ? <RegisterDialog session={{ id: s.id, label: `${day(s.date)}`, length: s.endMinutes - s.startMinutes, marks, taken: !!s.registerAt }}
                      candidates={active.map((c) => ({ id: c.id, name: c.name }))} /> : null}
                    {canManage && open ? <SessionDialog courseId={course.id} areas={areas} session={{ id: s.id, date: s.date, startMinutes: s.startMinutes, endMinutes: s.endMinutes, place: s.place, note: s.note }}
                      trigger={<Button variant="outline" size="icon" aria-label={`Change the session on ${day(s.date)}`}><Pencil aria-hidden="true" /></Button>} /> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="pc-panel" aria-labelledby="ac-candidates">
        <div className="pc-panel-head">
          <div className="flex flex-col gap-1"><h2 id="ac-candidates">Candidates · {course.taken} of {course.capacity}</h2>
            <p className="pc-row-hint">Staff and members of the public. Payment is taken elsewhere and recorded here.</p></div>
          {canRun && open && course.taken < course.capacity ? <CandidateDialog courseId={course.id} staff={staff} priceCents={course.priceCents} /> : null}
        </div>
        {candidates.length === 0 ? <EmptyState compact icon="users" title="Nobody on the course yet" hint={canRun ? "Add each candidate with their payment." : undefined} /> : (
          <ul className="pc-rows">
            {candidates.map((c) => {
              const r = c.readiness;
              const checksDone = r.checks.filter((x) => x.done).length;
              const missing = r.checks.filter((x) => !x.done);
              const toCall = c.source === "online" && c.payment === "owed" && c.status === "booked" && open;
              const due = toCall ? callDue(c.callBy ?? c.createdAt) : null;
              return (
                <li key={c.id} className="pc-row" {...(c.status === "withdrawn" ? { "data-muted": "" } : {})}>
                  <span className="pc-row-body">
                    <span className="pc-row-title">{c.name}{c.userId ? <span className="ml-2 text-xs font-normal text-ui-muted-foreground">Staff</span> : null}</span>
                    <span className="pc-row-hint">{[
                      c.source === "online" ? `held online${c.reference ? ` ${c.reference}` : ""}, ${c.phone}` : null,
                      r.checks.length ? `checks ${checksDone} of ${r.checks.length}${missing.length ? ` (${missing.map((m) => m.detail === "Not done" ? m.label.toLowerCase() : m.detail.toLowerCase()).join(", ")})` : ""}` : null,
                      `${hoursLabel(c.attended)} attended${course.type.minHours ? ` of ${course.type.minHours}h` : ""}`,
                      c.paidCents ? `${euro(c.paidCents)} paid` : null,
                      c.certificateNumber ? `certificate ${c.certificateNumber}${c.certificateExpires ? `, expires ${day(c.certificateExpires)}` : ""}` : null,
                    ].filter(Boolean).join(" · ")}</span>
                    {c.resultNote ? <span className="pc-row-hint">{c.resultNote}</span> : null}
                  </span>
                  <span className="pc-row-trail flex-wrap">
                    {due ? <Tag meta={ACADEMY_CALL_DUE_META[due.due]} label={due.due === "overdue" ? due.label : `Call by ${due.label}`} /> : null}
                    <Tag meta={ACADEMY_PAYMENT_META[c.payment as AcademyPayment] ?? ACADEMY_PAYMENT_META.owed} />
                    {toCall ? <CallDialog primary={due?.due === "overdue"} course={`${course.type.name} at ${course.site.name}`} priceCents={course.priceCents}
                      person={{ id: c.id, name: c.name, phone: c.phone, phone2: c.phone2, callTimes: c.callTimes, reference: c.reference, heldAt: formatDateTime(c.createdAt),
                        calls: c.calls.map((x) => ({ outcome: x.outcome, byName: x.byName, at: formatDateTime(x.createdAt), note: x.note })) }} /> : null}
                    <Tag meta={ACADEMY_RESULT_META[c.status as AcademyResult] ?? ACADEMY_RESULT_META.booked} />
                    {c.status === "booked" && r.ready ? <span className="text-xs text-ui-muted-foreground">Ready for assessment</span> : null}
                    {canRun && open ? <>
                      {c.status !== "withdrawn" && r.checks.length ? <ChecksDialog candidate={c} asks={course.type.checks} /> : null}
                      {c.status !== "withdrawn" && course.first && course.first <= today ? <ResultDialog candidate={{ ...c, isStaff: !!c.userId }} today={today} grants={grants} /> : null}
                      <CandidateDialog courseId={course.id} staff={staff} priceCents={course.priceCents} candidate={c}
                        trigger={<Button variant="outline" size="icon" aria-label={`Change ${c.name}`}><Pencil aria-hidden="true" /></Button>} />
                      {c.status === "booked" || c.status === "withdrawn" ? <WithdrawButton id={c.id} name={c.name} withdrawn={c.status === "withdrawn"} /> : null}
                    </> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {active.length ? <p className="text-xs text-ui-muted-foreground">{plural(active.filter((c) => c.readiness.ready && c.status === "booked").length, "candidate")} ready for assessment. A staff member who passes gets {grants ?? "nothing"} on their record.</p> : null}
      </section>
    </div>
  );
}
