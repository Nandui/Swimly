import type { Account } from "@/access/session";
import { clock, dayOnly, DAYS, type Day } from "@/data/dates";
import { db } from "@/data/db";
import { sharedRoots, type Waiting } from "./waiting";

/** A class at the swimmer's level with a free place. */
export type OpenClass = { id: string; day: Day; time: string; label: string; where: string; instructor: string; free: number | null; capacity: number | null };

/** The swimmer on screen: what the desk needs to ring the family and choose a class.
 *  Contact details are here because ringing is the job; medical notes never are. */
export type Swimmer = {
  waitingId: string;
  studentId: string;
  name: string;
  firstName: string;
  age: number | null;
  level: string | null;
  site: string | null;
  days: number;
  contact: { name: string | null; phone: string } | null;
  /** On a class's waiting list with no assessment behind it: Turnfin still handles those. */
  waitingListOnly: boolean;
  classes: OpenClass[];
};

const DAY_NAMES: Record<Day, string> = { MONDAY: "Monday", TUESDAY: "Tuesday", WEDNESDAY: "Wednesday", THURSDAY: "Thursday", FRIDAY: "Friday", SATURDAY: "Saturday", SUNDAY: "Sunday" };
export const dayName = (day: Day) => DAY_NAMES[day];

function ageOn(born: Date | null, today: Date): number | null {
  if (!born) return null;
  let age = today.getUTCFullYear() - born.getUTCFullYear();
  if (today.getUTCMonth() < born.getUTCMonth() || (today.getUTCMonth() === born.getUTCMonth() && today.getUTCDate() < born.getUTCDate())) age -= 1;
  return age >= 0 ? age : null;
}

/** Everything for one swimmer in the queue. The caller holds the desk grant and got `waiting`
 *  from the person's own queue, so the swimmer is one they may see. */
export async function swimmerFor(account: Account, waiting: Waiting): Promise<Swimmer | null> {
  const today = dayOnly();
  const student = await db.student.findFirst({
    where: { id: waiting.studentId, club: { orgId: account.orgId } },
    select: { id: true, firstName: true, lastName: true, dateOfBirth: true, contactName: true, contactPhone: true },
  });
  if (!student) return null;
  const base = {
    waitingId: waiting.id, studentId: student.id,
    name: `${student.firstName} ${student.lastName}`.trim(), firstName: student.firstName,
    age: ageOn(student.dateOfBirth, today),
    days: Math.max(0, Math.floor((today.getTime() - dayOnly(waiting.since).getTime()) / 86_400_000)),
    contact: student.contactPhone ? { name: student.contactName, phone: student.contactPhone } : null,
  };
  const reason = waiting.reason;
  if (!reason) return { ...base, level: null, site: null, waitingListOnly: true, classes: [] };

  const [levels, site, held] = await Promise.all([
    db.level.findMany({ select: { id: true, sharedWithId: true, name: true } }),
    db.club.findUnique({ where: { id: reason.siteId }, select: { name: true } }),
    db.enrolment.findMany({ where: { studentId: student.id, status: { in: ["ACTIVE", "WAITLISTED"] } }, select: { courseId: true } }),
  ]);
  const levelOf = sharedRoots(levels);
  const root = levelOf(reason.levelId);
  const sameLevel = levels.filter((level) => levelOf(level.id) === root).map((level) => level.id);
  const courses = await db.course.findMany({
    where: { clubId: reason.siteId, archivedAt: null, levelId: { in: sameLevel }, level: { archivedAt: null }, id: { notIn: held.map((row) => row.courseId) } },
    select: {
      id: true, name: true, dayOfWeek: true, startMinutes: true, capacity: true, location: true,
      instructor: { select: { name: true } },
      _count: { select: { enrolments: { where: { status: "ACTIVE" } } } },
    },
  });
  const levelName = levels.find((level) => level.id === root)?.name ?? null;
  const classes = courses
    .filter((course) => course.capacity === null || course._count.enrolments < course.capacity)
    .sort((a, b) => DAYS.indexOf(a.dayOfWeek) - DAYS.indexOf(b.dayOfWeek) || a.startMinutes - b.startMinutes || a.id.localeCompare(b.id))
    .map((course): OpenClass => ({
      id: course.id, day: course.dayOfWeek, time: clock(course.startMinutes),
      label: course.name ?? levelName ?? "Class",
      where: course.location ?? "", instructor: course.instructor?.name ?? "Nobody teaching yet",
      free: course.capacity === null ? null : course.capacity - course._count.enrolments, capacity: course.capacity,
    }));
  return { ...base, level: levelName, site: site?.name ?? null, waitingListOnly: false, classes };
}

/** A place just made here, for the sentence that confirms it. */
export async function placedSummary(account: Account, enrolmentId: string): Promise<{ name: string; label: string } | null> {
  const row = await db.enrolment.findFirst({
    where: { id: enrolmentId, status: "ACTIVE", course: { club: { orgId: account.orgId } } },
    select: { student: { select: { firstName: true, lastName: true } }, course: { select: { name: true, dayOfWeek: true, startMinutes: true, level: { select: { name: true } } } } },
  });
  if (!row) return null;
  return {
    name: `${row.student.firstName} ${row.student.lastName}`.trim(),
    label: `${row.course.name ?? row.course.level.name}, ${dayName(row.course.dayOfWeek)} ${clock(row.course.startMinutes)}`,
  };
}
