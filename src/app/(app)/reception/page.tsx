import type { Metadata } from "next";
import { ReceptionDashboard } from "@/components/reception/dashboard";
import { can, canSee } from "@/lib/authz";
import { weekdayOfIso } from "@/lib/attendance/dates";
import { getCoversForDay } from "@/lib/attendance/data/cover";
import { getCurrentClub } from "@/lib/clubs/current";
import { getCoursesOnDay } from "@/lib/courses/data/courses";
import { formatDate, minutesNow, parseDateOnly, today } from "@/lib/format";
import { screenPage } from "@/lib/page-guards";
import { getReceptionClassOptions, getReceptionSwimmer } from "@/lib/reception/data";

export const metadata: Metadata = { title: "Reception" };

export default async function ReceptionPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await screenPage("reception");
  const params = await searchParams;
  const swimmerId = typeof params.swimmer === "string" && params.swimmer.length <= 120 ? params.swimmer : null;
  const group = params.group === "level" ? "level" : "time";
  const manage = can(session, "enrolment.manage");
  const iso = today();
  const [courses, covers, student, targets, { club, clubs }] = await Promise.all([
    getCoursesOnDay(weekdayOfIso(iso)), getCoversForDay(iso),
    swimmerId ? getReceptionSwimmer(swimmerId) : null,
    swimmerId && manage ? getReceptionClassOptions() : [], getCurrentClub(),
  ]);

  return <ReceptionDashboard
    key={club.id}
    sites={clubs} clubId={club.id} clubName={club.name}
    dateLabel={formatDate(parseDateOnly(iso))}
    now={minutesNow()}
    courses={courses.map(({ id, name, dayOfWeek, startMinutes, durationMinutes, capacity, location, level, instructor, _count }) => ({
      id, name, dayOfWeek, startMinutes, durationMinutes, capacity, location, level, instructor, _count,
      coverName: covers.get(id)?.coverByName ?? null,
    }))}
    student={student} targets={targets} group={group}
    unavailable={Boolean(params.swimmer) && !student}
    access={{ manage, addSwimmers: can(session, "students.manage"), students: canSee(session, "students"), courses: canSee(session, "courses"),
      together: canSee(session, "together"), assessments: canSee(session, "assessments") }}
  />;
}
