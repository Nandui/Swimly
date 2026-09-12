import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardList,
  LockKeyhole,
} from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Item, ItemContent, ItemGroup } from "@/components/shadcn/item";
import { RegisterForm } from "@/components/attendance/register-form";
import { DeckChecklist } from "@/components/progression/deck-checklist";
import { getInstructorClass } from "@/lib/attendance/data/instructor-class";
import {
  instructorClassHref,
  instructorHomeHref,
  type ClassQuery,
} from "@/lib/attendance/navigation";
import { can } from "@/lib/authz";
import { courseName, formatSlot } from "@/lib/courses/constants";
import { formatDate, parseDateOnly, today } from "@/lib/format";
import { fullName } from "@/lib/students/constants";
import { TeachingNotice } from "./teaching-ui";
import { StartClass } from "./start-class";
import { CompleteLevel } from "./complete-level";

export async function InstructorClassSession({
  id,
  params,
}: {
  id: string;
  params: ClassQuery;
}) {
  const view = await getInstructorClass(id, params.date);
  if (!view) notFound();
  const { course, session, iso } = view,
    name = courseName(course),
    home = instructorHomeHref(params);
  const competencies = params.step === "competencies";
  const stepHref = (step: string) =>
    instructorClassHref(id, { ...params, date: iso, step });
  const header = (
    <div className="space-y-3">
      <Button asChild variant="ghost" className="-ml-3">
        <Link href={home}>
          <ArrowLeft aria-hidden="true" />
          Your classes
        </Link>
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
          <p className="text-sm text-ui-muted-foreground">
            {formatSlot(course)} · {formatDate(parseDateOnly(iso))}
            {course.location ? ` · ${course.location}` : ""}
          </p>
        </div>
        {view.state === "ready" ? (
          <p className="flex items-center gap-2 text-sm text-ui-muted-foreground">
            {view.register.taken ? (
              <Check className="size-4" aria-hidden="true" />
            ) : (
              <ClipboardList className="size-4" aria-hidden="true" />
            )}
            {view.register.taken ? "Attendance saved" : "Attendance to take"}
          </p>
        ) : null}
      </div>
    </div>
  );
  if (view.state !== "ready")
    return (
      <div className="flex flex-col gap-6">
        {header}
        {view.state === "locked" ? (
          <TeachingNotice title="This class is in progress">
            <p>
              {view.claim?.coverByName} has started this class. Only that
              instructor can open its attendance and competencies.
            </p>
          </TeachingNotice>
        ) : view.state === "wrong-site" ? (
          <TeachingNotice title={`This class is at ${course.club.name}`}>
            <p>Choose that site in the site switcher to continue.</p>
          </TeachingNotice>
        ) : view.state === "archived" ? (
          <TeachingNotice title="This class is archived." />
        ) : (
          <section className="flex flex-col items-start gap-4 rounded-ui-lg border border-ui-border p-5">
            <h2 className="text-lg font-semibold">Ready to teach?</h2>
            <p className="max-w-prose text-sm text-ui-muted-foreground">
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
                schedule={formatSlot(course)}
                own={course.instructorId === session.user.id}
                instructorName={course.instructor?.name ?? null}
                href={stepHref("attendance")}
              />
            ) : (
              <p className="flex items-center gap-2 text-sm text-ui-muted-foreground">
                <LockKeyhole className="size-4" aria-hidden="true" />
                {iso !== today()
                  ? "Start a class from today’s list on the day it runs."
                  : "You can only start your own classes."}
              </p>
            )}
          </section>
        )}
      </div>
    );
  const { register, progress } = view,
    mayAssess = can(session, "progression.assess"),
    mayComplete = mayAssess && can(session, "progression.complete");
  const ready = progress.swimmers.filter((s) => s.eligible && !s.completedOn);
  return (
    <div className="flex flex-col gap-6">
      {header}
      <nav
        aria-label="Class steps"
        className="flex gap-2 border-b border-ui-border pb-3"
      >
        <Button asChild variant={competencies ? "ghost" : "secondary"}>
          <Link
            href={stepHref("attendance")}
            aria-current={!competencies ? "step" : undefined}
          >
            1. Attendance
          </Link>
        </Button>
        <Button asChild variant={competencies ? "secondary" : "ghost"}>
          <Link
            href={stepHref("competencies")}
            aria-current={competencies ? "step" : undefined}
          >
            2. Competencies
          </Link>
        </Button>
      </nav>
      {!competencies ? (
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
          <div className="space-y-4">
            <p className="text-ui-muted-foreground">
              No swimmers were enrolled for this class on that date.
            </p>
            <Button asChild variant="outline">
              <Link href={stepHref("competencies")}>
                Competencies
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        )
      ) : (
        <>
          {!mayAssess ? (
            <TeachingNotice title="You can view competencies but do not have permission to mark them." />
          ) : null}
          {ready.length && mayComplete ? (
            <section className="space-y-2" aria-label="Ready to complete">
              <h2 className="text-lg font-semibold">
                Ready to complete {progress.course.level.name}
              </h2>
              <ItemGroup className="divide-y divide-ui-border">
                {ready.map((s) => (
                  <Item key={s.student.id} role="listitem" className="px-0">
                    <ItemContent>
                      <p className="font-medium">{fullName(s.student)}</p>
                      <p className="text-sm text-ui-muted-foreground">
                        All {s.total} competencies achieved
                      </p>
                    </ItemContent>
                    <CompleteLevel
                      studentId={s.student.id}
                      studentName={fullName(s.student)}
                      levelId={progress.course.levelId}
                      levelName={progress.course.level.name}
                      courseId={id}
                      date={iso}
                    />
                  </Item>
                ))}
              </ItemGroup>
            </section>
          ) : null}
          <DeckChecklist
            courseId={id}
            date={iso}
            levelId={progress.course.levelId}
            competencies={progress.course.level.competencies}
            swimmers={progress.swimmers.map((s) => ({
              studentId: s.student.id,
              name: fullName(s.student),
              offLevel: s.offLevel,
              completed: Boolean(s.completedOn),
              marks: Object.fromEntries(
                s.competencies.map((c) => [c.id, c.status]),
              ),
            }))}
            attendance={
              register.taken
                ? Object.fromEntries(
                    register.lines.map((l) => [l.studentId, l.status]),
                  )
                : null
            }
            readOnly={!mayAssess}
            teaching
            doneHref={home}
            doneLabel="classes"
          />
        </>
      )}
    </div>
  );
}
