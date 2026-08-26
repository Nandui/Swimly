import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, ClipboardList } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { Button } from "@/components/ui/button";
import { canMarkRegister } from "@/lib/attendance/access";
import { weekdayOfIso } from "@/lib/attendance/dates";
import { getRegisterStateForDay } from "@/lib/attendance/data/register";
import { isAdmin } from "@/lib/authz";
import {
  DAY_META,
  capacityLabel,
  courseName,
  formatTime,
} from "@/lib/courses/constants";
import { getCoursesOnDay } from "@/lib/courses/data/courses";
import { formatDate, parseDateOnly, today } from "@/lib/format";
import { managePage } from "@/lib/page-guards";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage(props: PageProps<"/today">) {
  const session = await managePage();
  const params = await props.searchParams;
  const showAll = params.show === "all";

  const iso = today();
  const day = weekdayOfIso(iso);

  const [courses, marked] = await Promise.all([
    getCoursesOnDay(day, showAll ? undefined : session.user.id),
    getRegisterStateForDay(day, iso),
  ]);

  const outstanding = courses.filter((course) => !marked.has(course.id)).length;
  const admin = isAdmin(session.user.role);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Today"
        description={`${DAY_META[day].label}, ${formatDate(parseDateOnly(iso))}`}
      />

      <p className="max-w-prose text-sm text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">{courses.length}</span>{" "}
        {courses.length === 1 ? "class" : "classes"}
        {showAll ? " across the pool" : " of yours"} today
        {outstanding > 0 ? (
          <>
            , and{" "}
            <span className="font-medium text-(--tag-orange-fg) tabular-nums">{outstanding}</span>{" "}
            {outstanding === 1 ? "register is" : "registers are"} still to take
          </>
        ) : courses.length > 0 ? (
          <>, and every register is in</>
        ) : null}
        .
      </p>

      <div className="border-b">
        <div role="group" aria-label="Show" className="-mb-px flex items-center gap-1">
          <Lens href="/today" active={!showAll} label="Mine" />
          <Lens href="/today?show=all" active={showAll} label="All classes" />
        </div>
      </div>

      {courses.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title={showAll ? "Nothing runs today" : "No classes of yours today"}
          hint={
            showAll
              ? "No course is timetabled for today."
              : "Switch to all classes to see what else is on."
          }
        />
      ) : (
        <ul className="overflow-hidden rounded-md border">
          {courses.map((course) => {
            const done = marked.has(course.id);
            const mayMark = canMarkRegister({
              role: session.user.role,
              userId: session.user.id,
              instructorId: course.instructorId,
            });
            return (
              <li
                key={course.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b p-3 transition-colors last:border-0 hover:bg-accent/40"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    <span className="tabular-nums">{formatTime(course.startMinutes)}</span>{" "}
                    <Link
                      href={`/courses/${course.id}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {courseName(course)}
                    </Link>
                    {done ? (
                      <Tag color="green" className="ml-2">
                        Attendance taken
                      </Tag>
                    ) : (
                      <Tag color="yellow" className="ml-2">
                        Attendance not taken
                      </Tag>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {course.level.name} · {capacityLabel(course._count.enrolments, course.capacity)}
                    {course.location ? ` · ${course.location}` : ""}
                    {showAll && course.instructor ? ` · ${course.instructor.name}` : ""}
                  </p>
                </div>

                <Button
                  asChild
                  size="sm"
                  variant={done || !mayMark ? "outline" : "default"}
                  className="max-sm:w-full"
                >
                  <Link href={`/courses/${course.id}/register?date=${iso}`}>
                    <ClipboardList className="size-4" />
                    {mayMark ? (done ? "Amend" : "Take Attendance") : "Read attendance"}
                  </Link>
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {!showAll && !admin ? (
        <p className="max-w-prose text-xs text-muted-foreground">
          You can only mark the classes you are assigned to. If you are covering for someone, an
          admin can reassign the course.
        </p>
      ) : null}
    </div>
  );
}

function Lens({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "border-b-2 px-2.5 py-2 text-[13px] font-medium transition-colors",
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </Link>
  );
}
