import type { ParentAccount, Prisma } from "@/generated/prisma/client";
import { parseDateOnly, today, weekdayOf } from "@/lib/format";
import { requireChild } from "@/lib/parent/children";
import { dublinInstant, PARENT_TIMEZONE } from "@/lib/parent/time";

const DAY = 86_400_000;
const courseSelect = {
  id: true, name: true, dayOfWeek: true, startMinutes: true, durationMinutes: true, location: true,
  club: { select: { id: true, name: true } },
  level: { select: { name: true, programme: { select: { name: true } } } },
  instructor: { select: { name: true } },
} as const satisfies Prisma.CourseSelect;
type Course = Prisma.CourseGetPayload<{ select: typeof courseSelect }>;

function lesson(course: Course, date: Date, instructorName = course.instructor?.name ?? null) {
  const iso = date.toISOString().slice(0, 10);
  const start = dublinInstant(iso, course.startMinutes);
  if (!start) return null;
  return { courseId: course.id, className: course.name || course.level.name,
    level: course.level.name, programme: course.level.programme.name,
    site: course.club, location: course.location, instructorName, date: iso,
    startMinutes: course.startMinutes, durationMinutes: course.durationMinutes,
    startsAt: start.toISOString(), endsAt: new Date(start.getTime() + course.durationMinutes * 60_000).toISOString() };
}

/** Only a guardian-approved child's own timetable and attendance; no register or notes. */
export async function childLessons(tx: Prisma.TransactionClient, parent: ParentAccount, childId: string, now = new Date()) {
  const child = await requireChild(tx, parent, childId);
  const day = parseDateOnly(today(now)), from = new Date(day.getTime() - 83 * DAY), until = new Date(day.getTime() + 90 * DAY);
  const [enrolments, records, cancellations, weeklyEnrolment] = await Promise.all([
    tx.enrolment.findMany({ where: { studentId: childId, status: "ACTIVE", startedOn: { lte: until },
      AND: [{ OR: [{ endedOn: null }, { endedOn: { gt: day } }] }, { OR: [{ scheduledEndOn: null }, { scheduledEndOn: { gt: day } }] }],
      course: { archivedAt: null, club: { archivedAt: null } } },
      select: { startedOn: true, endedOn: true, scheduledEndOn: true, course: { select: { ...courseSelect,
        covers: { where: { date: { gte: day, lte: until } }, select: { date: true, coverByName: true } },
        cancellations: { where: { date: { gte: day, lte: until } }, select: { date: true } },
      } } } }),
    tx.attendanceRecord.findMany({ where: { studentId: childId, date: { gte: from, lte: day } },
      select: { date: true, status: true, course: { select: courseSelect } }, orderBy: [{ date: "desc" }, { courseId: "asc" }] }),
    tx.classCancellation.findMany({ where: { date: { gte: from, lte: until },
      OR: [{ swimmers: { some: { studentId: childId } } }, { course: { attendance: { some: { studentId: childId, date: { gte: from, lte: day } } } } }] },
      select: { courseId: true, date: true, className: true, startMinutes: true, durationMinutes: true,
        course: { select: { club: { select: { id: true, name: true } } } },
        swimmers: { where: { studentId: childId }, select: { studentId: true } } } }),
    // Keep former swimmers' journals even when their last lesson is outside the
    // attendance window. An assessment or waiting-list place is not a lesson.
    tx.enrolment.findFirst({ where: { studentId: childId, status: { not: "WAITLISTED" } }, select: { id: true } }),
  ]);
  const upcoming = new Map<string, NonNullable<ReturnType<typeof lesson>>>();
  const cancelledUpcoming = new Map<string, NonNullable<ReturnType<typeof lesson>>>();
  if (child.status === "ACTIVE") for (const enrolment of enrolments) {
    const course = enrolment.course;
    const cancelled = new Set(course.cancellations.map(c => c.date.toISOString().slice(0, 10)));
    for (let offset = 0; offset <= 90; offset++) {
      const date = new Date(day.getTime() + offset * DAY);
      if (date < enrolment.startedOn || (enrolment.endedOn && date >= enrolment.endedOn) ||
        (enrolment.scheduledEndOn && date >= enrolment.scheduledEndOn) || weekdayOf(date) !== course.dayOfWeek) continue;
      const cover = course.covers.find(c => c.date.getTime() === date.getTime());
      const item = lesson(course, date, cover?.coverByName ?? course.instructor?.name ?? null);
      if (!item || new Date(item.endsAt) <= now) continue;
      const key = `${course.id}:${item.date}`;
      if (cancelled.has(item.date)) { cancelledUpcoming.set(key, item); continue; }
      upcoming.set(key, item);
      break;
    }
  }
  const chronological = (a: { startsAt: string; courseId: string }, b: { startsAt: string; courseId: string }) =>
    a.startsAt.localeCompare(b.startsAt) || a.courseId.localeCompare(b.courseId);
  const nextLesson = [...upcoming.values()].sort(chronological)[0] ?? null;
  const cancelledKeys = new Set(cancellations.map(c => `${c.courseId}:${c.date.toISOString().slice(0, 10)}`));
  const history: { courseId: string; className: string; site: { id: string; name: string }; date: string; status: "PRESENT" | "LATE" | "ABSENT" | "CANCELLED" }[] = [];
  for (const record of records) {
    const item = lesson(record.course, record.date);
    if (!item || new Date(item.endsAt) > now || cancelledKeys.has(`${item.courseId}:${item.date}`)) continue;
    history.push({ courseId: item.courseId, className: item.className, site: item.site, date: item.date, status: record.status });
  }
  const present = history.filter(r => r.status === "PRESENT").length;
  const late = history.filter(r => r.status === "LATE").length;
  const absent = history.filter(r => r.status === "ABSENT").length;
  for (const cancellation of cancellations) {
    const iso = cancellation.date.toISOString().slice(0, 10), start = dublinInstant(iso, cancellation.startMinutes);
    if (!cancellation.swimmers.length || !start || start.getTime() + cancellation.durationMinutes * 60_000 > now.getTime()) continue;
    history.push({ courseId: cancellation.courseId, className: cancellation.className, site: cancellation.course.club,
      date: iso, status: "CANCELLED" });
  }
  history.sort((a, b) => b.date.localeCompare(a.date) || a.courseId.localeCompare(b.courseId));
  const recorded = present + late + absent;
  return { childId, timezone: PARENT_TIMEZONE, asOf: now.toISOString(), hasEnrolment: Boolean(weeklyEnrolment), nextLesson,
    scheduleThrough: until.toISOString().slice(0, 10),
    upcomingCancellations: [...cancelledUpcoming.values()].sort(chronological),
    attendance: { from: from.toISOString().slice(0, 10), to: today(now), present, late, absent,
      attended: present + late, recorded, rate: recorded ? Math.round((present + late) / recorded * 100) : null,
      cancelled: history.filter(r => r.status === "CANCELLED").length, history } };
}
