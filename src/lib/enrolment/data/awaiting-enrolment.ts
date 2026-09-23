import type { Prisma } from "@/generated/prisma/client";
import { requireSession } from "@/lib/authz";
import { currentClubId } from "@/lib/clubs/current";
import { getSharedCurriculum } from "@/lib/curriculum/data/shared";
import { prisma } from "@/lib/prisma";

import { FOLLOW_UP_SELECT, followUpSummary } from "@/lib/enrolment/data/follow-up";

const PAGE_SIZE = 20;
const CANDIDATE_SELECT = {
  id: true, studentId: true, assessedOn: true, outcomeLevelId: true,
  session: { select: { clubId: true, programmeId: true, date: true, startMinutes: true } },
  student: { select: { enrolments: { select: { id: true, programmeId: true, status: true, startedOn: true, endedOn: true } } } },
} as const satisfies Prisma.AssessmentBookingSelect;

/** Assessments and waitlists are independent reasons to follow up. Group them
 * by swimmer/shared programme without losing any requested classes. Only the
 * current page's contact details leave this read; medical data is never read. */
export async function getAwaitingEnrolment(input: { q?: string; page?: number } = {}) {
  await requireSession();
  const [clubId, curriculum] = await Promise.all([currentClubId(), getSharedCurriculum()]);
  const q = (input.q ?? "").trim().slice(0, 100);
  const studentFilter = {
    status: "ACTIVE",
    AND: q.split(/\s+/).filter(Boolean).map(term => ({ OR: [
      { firstName: { contains: term, mode: "insensitive" as const } },
      { lastName: { contains: term, mode: "insensitive" as const } },
      { memberNumber: { contains: term, mode: "insensitive" as const } },
    ] })),
  } satisfies Prisma.StudentWhereInput;
  const [candidates, waitlists] = await Promise.all([prisma.assessmentBooking.findMany({
    where: {
      status: "ATTENDED", outcomeLevelId: { not: null },
      student: {
        ...studentFilter,
        assessmentBookings: { some: { status: "ATTENDED", outcomeLevelId: { not: null }, session: { clubId } } },
      },
    },
    select: CANDIDATE_SELECT,
  }), prisma.enrolment.findMany({
    where: { status: "WAITLISTED", course: { clubId }, student: studentFilter },
    select: { id: true, studentId: true, programmeId: true, createdAt: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  })]);
  // Withdrawn waitlists never provided a class place. Their original action
  // distinguishes them from withdrawn enrolments without changing the schema.
  const withdrawnIds = [...new Set(candidates.flatMap(row => row.student.enrolments.filter(e => e.status === "WITHDRAWN").map(e => e.id)))];
  const history = withdrawnIds.length ? await prisma.auditLog.findMany({
    where: { entity: "Enrolment", entityId: { in: withdrawnIds }, action: { in: ["waitlist", "enrol"] } },
    select: { entityId: true, action: true },
  }) : [];
  const waitlistOrigins = new Set(history.filter(row => row.action === "waitlist").map(row => row.entityId));
  const classPlaces = new Set(history.filter(row => row.action === "enrol").map(row => row.entityId));
  const assessedDate = (row: typeof candidates[number]) => row.assessedOn ?? row.session.date;
  candidates.sort((a, b) => assessedDate(b).getTime() - assessedDate(a).getTime() || b.session.date.getTime() - a.session.date.getTime() || b.session.startMinutes - a.session.startMinutes || b.id.localeCompare(a.id));
  const seen = new Set<string>();
  const pending = candidates.filter(row => {
    const programmeId = curriculum.programmeIds.resolve(row.session.programmeId);
    const key = `${row.studentId}:${programmeId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    if (row.session.clubId !== clubId) return false;
    // A waitlist is not a class place. Enrolment in another programme does not
    // resolve this placement. A finished follow-up stays resolved after leaving.
    return !row.student.enrolments.some(enrolment => {
      if (curriculum.programmeIds.resolve(enrolment.programmeId) !== programmeId || enrolment.status === "WAITLISTED") return false;
      if (enrolment.status === "ACTIVE") return true;
      if (waitlistOrigins.has(enrolment.id) && !classPlaces.has(enrolment.id)) return false;
      return enrolment.startedOn >= assessedDate(row) || (!!enrolment.endedOn && enrolment.endedOn >= assessedDate(row));
    });
  }).sort((a, b) => assessedDate(a).getTime() - assessedDate(b).getTime() || a.id.localeCompare(b.id));
  type Entry = { id: string; studentId: string; programmeId: string; assessmentId: string | null; queuedOn: Date; waitlistIds: string[] };
  const queue = new Map<string, Entry>();
  for (const row of pending) {
    const programmeId = curriculum.programmeIds.resolve(row.session.programmeId);
    queue.set(`${row.studentId}:${programmeId}`, { id: row.id, studentId: row.studentId, programmeId, assessmentId: row.id, queuedOn: assessedDate(row), waitlistIds: [] });
  }
  for (const row of waitlists) {
    const programmeId = curriculum.programmeIds.resolve(row.programmeId);
    const key = `${row.studentId}:${programmeId}`;
    const entry = queue.get(key) ?? { id: row.id, studentId: row.studentId, programmeId, assessmentId: null, queuedOn: row.createdAt, waitlistIds: [] };
    entry.waitlistIds.push(row.id);
    if (row.createdAt < entry.queuedOn) entry.queuedOn = row.createdAt;
    queue.set(key, entry);
  }
  const ordered = [...queue.values()].sort((a, b) => a.queuedOn.getTime() - b.queuedOn.getTime() || a.id.localeCompare(b.id));
  const pages = Math.max(1, Math.ceil(ordered.length / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number.isSafeInteger(input.page) ? input.page! : 1));
  const selected = ordered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const assessmentIds = selected.flatMap(row => row.assessmentId ? [row.assessmentId] : []);
  const waitlistIds = selected.flatMap(row => row.waitlistIds);
  const [details, waitingClasses, students] = await Promise.all([
    assessmentIds.length ? prisma.assessmentBooking.findMany({
    where: { id: { in: assessmentIds } },
    select: {
      id: true, assessedOn: true,
      outcomeLevel: { select: { id: true, name: true } },
      session: { select: { id: true, date: true, startMinutes: true, programme: { select: { id: true, name: true } } } },
    },
  }) : [],
    waitlistIds.length ? prisma.enrolment.findMany({
      where: { id: { in: waitlistIds }, status: "WAITLISTED" },
      select: { id: true, createdAt: true, programme: { select: { id: true, name: true } }, course: { select: {
        id: true, name: true, dayOfWeek: true, startMinutes: true, archivedAt: true, capacity: true,
        level: { select: { id: true, name: true } },
        _count: { select: { enrolments: { where: { status: "ACTIVE" } } } },
      } } },
    }) : [],
    selected.length ? prisma.student.findMany({
      where: { id: { in: selected.map(row => row.studentId) } },
      select: { id: true, firstName: true, lastName: true, memberNumber: true, contactName: true, contactPhone: true, contactEmail: true, ...FOLLOW_UP_SELECT },
    }) : [],
  ]);
  const byId = new Map(details.map(row => [row.id, row]));
  const waitingById = new Map(waitingClasses.map(row => [row.id, row]));
  const studentsById = new Map(students.map(row => [row.id, row]));
  const items = selected.flatMap(candidate => {
    const row = candidate.assessmentId ? byId.get(candidate.assessmentId) : undefined;
    const student = studentsById.get(candidate.studentId);
    if (!student) return [];
    const waiting = candidate.waitlistIds.flatMap(id => {
      const enrolment = waitingById.get(id);
      if (!enrolment) return [];
      return [{ id: enrolment.id, createdAt: enrolment.createdAt, course: { ...enrolment.course,
        level: { id: curriculum.levelIds.resolve(enrolment.course.level.id), name: curriculum.level(enrolment.course.level.id)?.name ?? enrolment.course.level.name },
      } }];
    });
    const { enrolmentFollowUps, _count, ...studentDetails } = student;
    return [{ id: candidate.id, student: studentDetails, followUp: followUpSummary({ enrolmentFollowUps, _count }), queuedOn: candidate.queuedOn,
      assessedOn: row ? row.assessedOn ?? row.session.date : null, session: row?.session ?? null,
      programme: { id: candidate.programmeId, name: curriculum.programme(candidate.programmeId)?.name ?? row?.session.programme.name ?? waitingById.get(candidate.waitlistIds[0])?.programme.name ?? "Programme" },
      outcomeLevel: row?.outcomeLevel ? { id: curriculum.levelIds.resolve(row.outcomeLevel.id), name: curriculum.level(row.outcomeLevel.id)?.name ?? row.outcomeLevel.name } : null,
      waitlists: waiting,
    }];
  });
  return { items, total: ordered.length, page, pages, q };
}

export type AwaitingEnrolmentResult = Awaited<ReturnType<typeof getAwaitingEnrolment>>;
