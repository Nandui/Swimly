import type { Metadata } from "next";
import { TodayCalendar } from "@/components/today/calendar";
import { getCoversForDay } from "@/lib/attendance/data/cover";
import { getRegisterStateForDay } from "@/lib/attendance/data/register";
import { weekdayOfIso } from "@/lib/attendance/dates";
import { can, canSee } from "@/lib/authz";
import { getCurrentClub } from "@/lib/clubs/current";
import { getCoursesOnDay } from "@/lib/courses/data/courses";
import { minutesNow, today } from "@/lib/format";
import { screenPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Today’s classes" };

export default async function TodayPage() {
  const session = await screenPage("calendar");
  const instant = new Date();
  const iso = today(instant);
  const day = weekdayOfIso(iso);
  const [courses, marked, covers, { club }] = await Promise.all([
    getCoursesOnDay(day), getRegisterStateForDay(day, iso), getCoversForDay(iso), getCurrentClub(),
  ]);

  return <TodayCalendar key={`${club.id}-${iso}`} iso={iso} initialNow={minutesNow(instant)}
    clubName={club.name} me={session.user.id}
    access={{ attendance: can(session, "attendance.mark"), courses: canSee(session, "courses") }}
    courses={courses.map(({ id, name, startMinutes, durationMinutes, capacity, location, level, instructor, instructorId, _count }) => ({
      id, name, startMinutes, durationMinutes, capacity, location, level, instructor, instructorId,
      enrolled: _count.enrolments, cover: covers.get(id) ?? null, attendanceTaken: marked.has(id),
    }))} />;
}
