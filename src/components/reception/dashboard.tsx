"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { Button } from "@/components/workspace/actions";
import { Banner, Avatar, EmptyState } from "@/components/workspace/feedback";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/workspace/choices";
import {
  EndEnrolment,
  EnrolInCourseForStudent,
  PromoteFromWaitlist,
  TransferEnrolment,
} from "@/components/enrolment/enrolment-actions";
import { StudentSearch } from "@/components/students/student-search";
import { AddStudent } from "@/components/students/student-actions";
import { FormDialog, Field } from "@/components/form-dialog";
import { SearchablePicker } from "@/components/searchable-picker";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { bookStudent } from "@/lib/assessments/actions/bookings";
import {
  courseLabel,
  courseName,
  formatSlotShort,
  formatTime,
} from "@/lib/courses/constants";
import type { TransferTarget } from "@/lib/enrolment/data/enrolments";
import { ENROLMENT_STATUS_META } from "@/lib/enrolment/constants";
import type {
  ReceptionSwimmer,
  ReceptionAssessment,
} from "@/lib/reception/data";
import {
  groupReceptionClasses,
  receptionAvailability,
  receptionTimeStatus,
  RECEPTION_TIME_META,
  receptionHref,
  type ReceptionClass,
  type ReceptionGrouping,
} from "@/lib/reception/timetable";
import {
  ageLabel,
  fullName,
  STUDENT_STATUS_META,
} from "@/lib/students/constants";
import { formatDate } from "@/lib/format";

export type ReceptionDashboardProps = {
  clubName: string;
  dateLabel: string;
  now: number;
  courses: ReceptionClass[];
  student: ReceptionSwimmer | null;
  targets: TransferTarget[];
  assessments: ReceptionAssessment[];
  group: ReceptionGrouping;
  unavailable: boolean;
  access: {
    manage: boolean;
    manageStudents: boolean;
    students: boolean;
    courses: boolean;
    together: boolean;
    assessments: boolean;
  };
};
export function ReceptionDashboard({
  dateLabel,
  now,
  courses,
  student,
  targets,
  assessments,
  group,
  unavailable,
  access,
}: ReceptionDashboardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [refreshing, refreshTransition] = useTransition();
  const [timeWindow, setTimeWindow] = useState("current");
  const [mobileView, setMobileView] = useState("swimmer");
  const [detail, setDetail] = useState("places");
  useEffect(() => {
    function refreshIfIdle() {
      if (
        document.visibilityState !== "visible" ||
        document.querySelector('[role="dialog"]') ||
        document.activeElement?.matches("input,textarea,[role=combobox]")
      )
        return;
      refreshTransition(() => router.refresh());
    }
    const timer = window.setInterval(refreshIfIdle, 60_000);
    window.addEventListener("focus", refreshIfIdle);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshIfIdle);
    };
  }, [router]);
  const onNow = courses.filter(
    (course) =>
      course.startMinutes <= now &&
      course.startMinutes + course.durationMinutes > now,
  );
  const nextTime = courses
    .filter((course) => course.startMinutes > now)
    .reduce<
      number | null
    >((first, course) => (first === null ? course.startMinutes : Math.min(first, course.startMinutes)), null);
  const visibleCourses =
    timeWindow === "all"
      ? courses
      : courses.filter((course) =>
          ["running", "next"].includes(
            receptionTimeStatus(course, now, nextTime),
          ),
        );
  const sections = groupReceptionClasses(visibleCourses, group);
  const mayEnrol = access.manage && student?.status === "ACTIVE";
  return (
    <div className="desk-workspace">
      <PageHeader
        title="Reception"
        description={`A good day starts here. ${dateLabel}.`}
        actions={
          access.manageStudents ? (
            <AddStudent
              trigger={
                <Button
                  label="Add swimmer"
                  variant="secondary"
                  icon={<Plus size={18} />}
                />
              }
            />
          ) : undefined
        }
      />
      <div className="desk-search">
        <div className="desk-search-icon">
          <Search size={22} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <StudentSearch
            key={student?.id ?? "search"}
            label="Find a swimmer by name or member number"
            selected={student}
            includeInactive
            onSelect={(hit) => {
              setMobileView("swimmer");
              setDetail("places");
              startTransition(() =>
                router.push(receptionHref(hit?.id, group), { scroll: false }),
              );
            }}
            emptyText="No swimmers match in this club. Try their member number."
          />
        </div>
      </div>
      <nav aria-label="Reception views" className="desk-mobile-tabs">
        <SegmentedControl
          label="Reception view"
          value={mobileView}
          onChange={setMobileView}
        >
          <SegmentedControlItem value="swimmer" label="Swimmer" />
          <SegmentedControlItem value="today" label="Today" />
        </SegmentedControl>
      </nav>
      <div className="desk-panels" aria-busy={pending}>
        <section
          className="desk-panel"
          data-mobile-hidden={mobileView !== "swimmer"}
          aria-label="Selected swimmer"
        >
          {unavailable ? (
            <Banner
              status="warning"
              title="This swimmer is unavailable in the current club. Try another search."
            />
          ) : null}
          {student ? (
            <>
              <div className="desk-profile-heading">
                <Avatar name={fullName(student)} size="lg" />
                <div className="min-w-0 flex-1">
                  <h2>{fullName(student)}</h2>
                  <p className="muted">
                    {student.dateOfBirth
                      ? `Age ${ageLabel(student.dateOfBirth)} · `
                      : ""}
                    {student.memberNumber ?? "No member number"}
                  </p>
                </div>
                <Tag color={STUDENT_STATUS_META[student.status].color}>
                  {STUDENT_STATUS_META[student.status].label}
                </Tag>
              </div>
              <div className="desk-profile-actions">
                {mayEnrol ? (
                  <>
                    <EnrolInCourseForStudent
                      student={student}
                      courses={targets}
                    />
                    <BookAssessment student={student} sessions={assessments} />
                  </>
                ) : null}
                {access.students ? (
                  <Button
                    href={`/students/${student.id}`}
                    label="Profile"
                    variant="ghost"
                    endContent={<ArrowUpRight size={16} />}
                  />
                ) : null}
              </div>
              {student.status === "INACTIVE" ? (
                <div className="desk-panel-inset">
                  <Banner
                    status="info"
                    title="This swimmer needs to be active before booking or moving classes."
                  />
                </div>
              ) : null}
              <nav className="desk-detail-tabs" aria-label="Swimmer details">
                {[
                  { id: "places", label: "Places" },
                  { id: "contact", label: "Contact" },
                  { id: "notes", label: "Notes" },
                  { id: "progress", label: "Progress" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    aria-pressed={detail === tab.id}
                    onClick={() => setDetail(tab.id)}
                  >
                    {tab.label}
                    {tab.id === "notes" && student.medicalNotes ? (
                      <span
                        className="desk-attention-dot"
                        aria-label="Care note recorded"
                      />
                    ) : null}
                  </button>
                ))}
              </nav>
              <div className="desk-profile-body">
                {detail === "places" ? (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <h3>Classes and waitlist</h3>
                      <span className="muted small">
                        {student.enrolments.length} places
                      </span>
                    </div>
                    {student.enrolments.length === 0 ? (
                      <EmptyState
                        title="Ready for their first class"
                        description="Choose Enrol in class to find a suitable place, or book an assessment."
                        icon={<Users size={26} />}
                        isCompact
                      />
                    ) : (
                      <div className="desk-place-list">
                        {student.enrolments.map((enrolment) => {
                          const label = courseLabel(enrolment.course);
                          const status =
                            ENROLMENT_STATUS_META[enrolment.status];
                          const cover = courses.find(
                            (course) => course.id === enrolment.course.id,
                          )?.coverName;
                          return (
                            <section key={enrolment.id} className="desk-place">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <h3>{courseName(enrolment.course)}</h3>
                                <Tag color={status.color}>{status.label}</Tag>
                              </div>
                              <p className="font-medium tabular-nums">
                                {formatSlotShort(enrolment.course)}–
                                {formatTime(
                                  enrolment.course.startMinutes +
                                    enrolment.course.durationMinutes,
                                )}
                              </p>
                              <p className="muted">
                                {[
                                  enrolment.level.name,
                                  enrolment.course.location,
                                  cover
                                    ? `${cover} (cover today)`
                                    : enrolment.course.instructor?.name,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                              {enrolment.scheduledEndOn ? (
                                <p className="small muted">
                                  Unenrols{" "}
                                  {formatDate(enrolment.scheduledEndOn)}
                                </p>
                              ) : null}
                              {enrolment.course.archivedAt ? (
                                <p className="small muted">Archived class</p>
                              ) : null}
                              <div className="flex flex-wrap gap-2">
                                {mayEnrol &&
                                enrolment.status === "WAITLISTED" &&
                                !enrolment.course.archivedAt ? (
                                  <PromoteFromWaitlist
                                    variant="button"
                                    classLabel={label}
                                    enrolment={{ ...enrolment, student }}
                                  />
                                ) : null}
                                {mayEnrol ? (
                                  <TransferEnrolment
                                    variant="button"
                                    classLabel={label}
                                    enrolment={{ ...enrolment, student }}
                                    targets={targets.filter(
                                      (target) =>
                                        target.id !== enrolment.course.id,
                                    )}
                                  />
                                ) : null}
                                {access.manage ? (
                                  <EndEnrolment
                                    variant="button"
                                    enrolment={{ ...enrolment, student }}
                                    classLabel={label}
                                  />
                                ) : null}
                                {access.courses ? (
                                  <Button
                                    href={`/courses/${enrolment.course.id}`}
                                    label="Details"
                                    aria-label={`Class details for ${label}`}
                                    variant="ghost"
                                  />
                                ) : null}
                              </div>
                            </section>
                          );
                        })}
                      </div>
                    )}
                    {student.assessmentBookings.length ? (
                      <section className="desk-bookings">
                        <h3>Assessment bookings</h3>
                        {student.assessmentBookings.map((booking) => (
                          <p key={booking.id} className="mt-3">
                            <CalendarDays
                              size={16}
                              className="mr-2 inline"
                              aria-hidden="true"
                            />
                            {booking.session.programme.name}
                            <span className="block small muted mt-1">
                              {formatDate(booking.session.date)} ·{" "}
                              {formatTime(booking.session.startMinutes)}
                            </span>
                          </p>
                        ))}
                      </section>
                    ) : null}
                  </>
                ) : null}
                {detail === "contact" ? (
                  <section className="space-y-4">
                    <h3>Contact details</h3>
                    <p>{student.contactName || "No contact name recorded"}</p>
                    {student.contactPhone ? (
                      <a
                        className="workspace-link inline-flex min-h-11 items-center text-primary"
                        href={`tel:${student.contactPhone.replace(/\s+/g, "")}`}
                      >
                        {student.contactPhone}
                      </a>
                    ) : (
                      <p className="muted">No phone number recorded.</p>
                    )}
                    {student.contactEmail ? (
                      <a
                        className="block break-all min-h-11 text-primary"
                        href={`mailto:${student.contactEmail}`}
                      >
                        {student.contactEmail}
                      </a>
                    ) : null}
                  </section>
                ) : null}
                {detail === "notes" ? (
                  <section className="space-y-5">
                    <h3>Notes for the team</h3>
                    {student.medicalNotes ? (
                      <Banner
                        status="warning"
                        title="Care notes"
                        description={
                          <p className="whitespace-pre-wrap">
                            {student.medicalNotes}
                          </p>
                        }
                      />
                    ) : (
                      <p className="muted">No care notes recorded.</p>
                    )}
                    <p className="whitespace-pre-wrap">
                      {student.notes || "No general notes recorded."}
                    </p>
                  </section>
                ) : null}
                {detail === "progress" ? (
                  <section className="space-y-5">
                    <h3>Progress at a glance</h3>
                    {student.progress.length ? (
                      student.progress.map((programme) => (
                        <div key={programme.programmeId}>
                          <p className="font-medium">
                            {programme.programmeName}
                          </p>
                          {programme.levels
                            .filter(
                              (level) => level.isCurrent || level.completedOn,
                            )
                            .map((level) => (
                              <div className="mt-3" key={level.id}>
                                <div className="flex justify-between gap-3">
                                  <span>{level.name}</span>
                                  <span className="muted small">
                                    {level.completedOn
                                      ? "Completed"
                                      : `${level.achieved} of ${level.total} achieved`}
                                  </span>
                                </div>
                                <progress
                                  className="desk-progress"
                                  value={level.achieved}
                                  max={level.total || 1}
                                  aria-label={`${level.name} progress`}
                                />
                              </div>
                            ))}
                        </div>
                      ))
                    ) : (
                      <p className="muted">
                        Progress will appear when this swimmer joins a
                        programme.
                      </p>
                    )}
                  </section>
                ) : null}
              </div>
            </>
          ) : (
            <div className="desk-no-selection">
              <EmptyState
                title="Who can we help?"
                description="Find a swimmer above to see their places, contacts and next steps together."
                icon={<Search size={28} />}
              />
            </div>
          )}
        </section>
        <section
          className="desk-panel"
          data-mobile-hidden={mobileView !== "today"}
          aria-labelledby="desk-today"
        >
          <div className="desk-today-heading">
            <div>
              <p className="eyebrow">At the pool</p>
              <h2 id="desk-today">Today’s classes</h2>
              <p className="muted mt-1">
                {courses.length} classes · {onNow.length} running now
              </p>
            </div>
            <Button
              label="Refresh classes"
              variant="ghost"
              isLoading={refreshing}
              onClick={() => refreshTransition(() => router.refresh())}
            >
              Refresh
            </Button>
          </div>
          <div className="desk-today-filters">
            <SegmentedControl
              label="Show classes"
              value={timeWindow}
              onChange={setTimeWindow}
            >
              <SegmentedControlItem value="current" label="Now and next" />
              <SegmentedControlItem value="all" label="All day" />
            </SegmentedControl>
            <select
              aria-label="Group classes"
              value={group}
              onChange={(event) =>
                router.push(
                  receptionHref(
                    student?.id,
                    event.target.value as ReceptionGrouping,
                  ),
                  { scroll: false },
                )
              }
            >
              <option value="time">By time</option>
              <option value="level">By level</option>
            </select>
          </div>
          <div className="desk-schedule">
            {sections.length ? (
              sections.map((section) => (
                <section key={section.key}>
                  <div className="desk-schedule-label">
                    <h3>{section.title}</h3>
                    {section.description ? (
                      <span>{section.description}</span>
                    ) : null}
                  </div>
                  {section.courses.map((course) => (
                    <div className="desk-class-row" key={course.id}>
                      <div className="desk-time">
                        <strong>{formatTime(course.startMinutes)}</strong>
                        <span>
                          {formatTime(
                            course.startMinutes + course.durationMinutes,
                          )}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3>{courseName(course)}</h3>
                        <p className="muted small">
                          {[
                            course.level.name,
                            course.location,
                            course.coverName
                              ? `${course.coverName} (cover)`
                              : course.instructor?.name,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        <p className="small mt-1">
                          {receptionAvailability(
                            course._count.enrolments,
                            course.capacity,
                          )}
                        </p>
                      </div>
                      <div className="desk-class-end">
                        <Tag
                          color={
                            RECEPTION_TIME_META[
                              receptionTimeStatus(course, now, nextTime)
                            ].color
                          }
                        >
                          {
                            RECEPTION_TIME_META[
                              receptionTimeStatus(course, now, nextTime)
                            ].label
                          }
                        </Tag>
                        {access.courses ? (
                          <Button
                            href={`/courses/${course.id}`}
                            label={`Open ${courseLabel(course)}`}
                            variant="ghost"
                            isIconOnly
                            icon={<ChevronRight size={18} />}
                          />
                        ) : null}
                      </div>
                    </div>
                  ))}
                </section>
              ))
            ) : (
              <EmptyState
                title={courses.length ? "A quieter moment" : "No classes today"}
                description={
                  courses.length
                    ? "Switch to All day to see the rest of today's timetable."
                    : "You can still find swimmers and plan their next class."
                }
                icon={<CalendarDays size={26} />}
              />
            )}
          </div>
        </section>
      </div>
      <nav className="desk-shortcuts" aria-label="Reception shortcuts">
        {[
          {
            visible: access.students,
            href: "/students",
            label: "Browse swimmers",
          },
          {
            visible: access.courses,
            href: "/courses?day=any",
            label: "Find a class",
          },
          {
            visible: access.together,
            href: "/together",
            label: "Sibling times",
          },
          {
            visible: access.assessments,
            href: "/assessments",
            label: "Assessments",
          },
        ]
          .filter((item) => item.visible)
          .map((item) => (
            <Button
              key={item.href}
              href={item.href}
              label={item.label}
              variant="ghost"
              endContent={<ArrowUpRight size={14} />}
            />
          ))}
      </nav>
    </div>
  );
}
function BookAssessment({
  student,
  sessions,
}: {
  student: ReceptionSwimmer;
  sessions: ReceptionAssessment[];
}) {
  return (
    <FormDialog
      trigger={<Button label="Book assessment" variant="secondary" />}
      title={`Book an assessment for ${fullName(student)}`}
      description="Choose an upcoming session. Availability is checked again when you book."
      submitLabel="Book assessment"
      successMessage="Assessment booked"
      submit={(form) =>
        bookStudent({
          studentId: student.id,
          sessionId: String(form.get("sessionId") ?? ""),
        })
      }
    >
      <Field label="Assessment session" htmlFor="assessment-session">
        <SearchablePicker
          id="assessment-session"
          name="sessionId"
          placeholder="Choose a session"
          searchPlaceholder="Search sessions"
          emptyText="No assessment places are currently available."
          options={sessions.map((session) => ({
            value: session.id,
            label: `${session.programme.name} · ${formatDate(session.date)}`,
            hint: formatTime(session.startMinutes),
            meta:
              session.capacity === null
                ? "Places available"
                : `${Math.max(0, session.capacity - session._count.bookings)} places left`,
            disabled:
              session.capacity !== null &&
              session._count.bookings >= session.capacity,
          }))}
        />
      </Field>
    </FormDialog>
  );
}
