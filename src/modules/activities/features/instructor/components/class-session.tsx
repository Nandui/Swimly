import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, LockKeyhole } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Tag } from "@/components/ui-kit/tag";
import { ATTENDANCE_RECORD_META } from "@/modules/activities/shared/attendance/constants";
import { RegisterForm } from "@/modules/activities/shared/attendance/components/register-form";
import { DeckChecklist } from "@/modules/activities/shared/progression/components/deck-checklist";
import { getInstructorClass } from "@/modules/activities/shared/attendance/data/instructor-class";
import {
  instructorClassHref,
  instructorHomeHref,
  type ClassQuery,
} from "@/modules/activities/shared/attendance/navigation";
import { can } from "@/lib/authz";
import { courseName, formatSessionTime } from "@/modules/activities/shared/courses/constants";
import { formatDate, parseDateOnly, today } from "@/lib/format";
import { fullName } from "@/modules/activities/shared/students/constants";
import { Notice } from "@/components/ui-kit/notice";
import { PageHeader } from "@/components/ui-kit/page-header";
import { WrongClub } from "@/components/clubs/wrong-club";
import { StartClass } from "@/modules/activities/features/instructor/components/start-class";
import { InstructorClassNavigation } from "@/modules/activities/features/instructor/components/class-navigation";
import { ClassCompetencyOverview } from "@/modules/activities/features/instructor/components/class-competency-overview";

export async function InstructorClassSession({
  id,
  params,
  overview = false,
}: {
  id: string;
  params: ClassQuery;
  overview?: boolean;
}) {
  const view = await getInstructorClass(id, params.date);
  if (!view) notFound();
  const { course, session, iso } = view,
    name = courseName(course),
    home = instructorHomeHref(params);
  const competencies = params.step === "competencies";
  const stepHref = (step: string) =>
    instructorClassHref(id, { ...params, date: iso, step });
  // "Sun 16:00 to 16:30 · 4 Oct 2026": this one dated session, not the weekly slot.
  const when = `${formatSessionTime(course)} · ${formatDate(parseDateOnly(iso))}`;
  const header = (
    <PageHeader
      back={{ href: home, label: "Classes" }}
      title={name}
      description={`${when}${course.location ? ` · ${course.location}` : ""}`}
      status={
        view.state === "ready" ? (
          <Tag meta={view.register.taken ? ATTENDANCE_RECORD_META.taken : ATTENDANCE_RECORD_META.notTaken} />
        ) : null
      }
    />
  );
  if (view.state !== "ready")
    return (
      <>
        {header}
        {view.state === "cancelled" ? <Notice tone="warning" title="This session is cancelled"><p>{view.cancellation.reason}</p><p>Attendance and competencies cannot be saved for this session.</p></Notice> : view.state === "wrong-site" ? (
          <WrongClub header={false} what="This class" noun="this class" owner={course.club} current={view.club} />
        ) : view.state === "archived" ? (
          <Notice tone="warning" title="This class is archived" />
        ) : (
          <section className="pc-panel items-start" aria-labelledby="ready-to-teach">
            <h2 id="ready-to-teach">Ready to teach?</h2>
            <p className="max-w-prose text-ui-muted-foreground">
              Confirm you are taking this class before opening the swimmers’
              attendance and competencies.
            </p>
            {iso === today() &&
            (course.instructorId === session.user.id ||
              can(session, "attendance.cover")) ? (
              <StartClass
                courseId={id}
                date={iso}
                name={name}
                schedule={when}
                own={course.instructorId === session.user.id}
                instructorName={course.instructor?.name ?? null}
                href={stepHref("attendance")}
              />
            ) : (
              <p className="flex items-center gap-2 text-ui-muted-foreground">
                <LockKeyhole className="size-4" aria-hidden="true" />
                {iso !== today()
                  ? "Start a class from today’s list on the day it runs."
                  : "You can only start your own classes."}
              </p>
            )}
          </section>
        )}
      </>
    );
  const { register, progress } = view,
    mayAssess = can(session, "progression.assess"),
    mayComplete = mayAssess && can(session, "progression.complete");
  const swimmers = progress.swimmers.map((s) => ({
    studentId: s.student.id,
    name: fullName(s.student),
    offLevel: s.offLevel,
    completed: Boolean(s.completedOn),
    readyToMoveAt: s.readyToMoveAt,
    readyToMoveByName: s.readyToMoveByName,
    moveReadinessCurrent: s.moveReadinessCurrent,
    marks: Object.fromEntries(s.competencies.map((c) => [c.id, c.status])),
  }));
  const attendance = register.taken
    ? Object.fromEntries(register.lines.map((l) => [l.studentId, l.status]))
    : null;
  return (
    <>
      {header}
      <InstructorClassNavigation id={id} params={{ ...params, date: iso }} active={overview ? "overview" : competencies ? "competencies" : "attendance"} />
      {overview ? (
        <ClassCompetencyOverview competencies={progress.course.level.competencies} swimmers={swimmers} />
      ) : !competencies ? (
        register.lines.length ? (
          <RegisterForm
            courseId={id}
            date={iso}
            revision={register.revision}
            lines={register.lines}
            classNote={register.note?.note ?? null}
            readOnly={false}
            teaching
            continueHref={stepHref("competencies")}
          />
        ) : (
          <EmptyState
            icon="users"
            title="No swimmers enrolled"
            hint="Nobody was enrolled in this class on that date."
            action={
              <Button asChild variant="outline">
                <Link href={stepHref("competencies")}>
                  Competencies
                  <ChevronRight aria-hidden="true" />
                </Link>
              </Button>
            }
          />
        )
      ) : (
        <>
          {!mayAssess ? (
            <Notice title="You can view competencies but do not have permission to mark them." />
          ) : null}
          <DeckChecklist
            courseId={id}
            date={iso}
            levelId={progress.course.levelId}
            competencies={progress.course.level.competencies}
            swimmers={swimmers}
            attendance={attendance}
            readOnly={!mayAssess}
            teaching
            moveReadiness={mayComplete ? { levelName: progress.course.level.name } : undefined}
            doneHref={home}
            doneLabel="classes"
          />
        </>
      )}
    </>
  );
}
