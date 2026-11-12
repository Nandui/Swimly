import "server-only";
import { logAudit } from "@/lib/audit";
import { staffByIds } from "@/lib/directory";
import { isDateOnly, parseDateOnly, plural } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { Commitment, CommitmentPlan, CommitmentQuery } from "@/modules/contributions";

/** What assessments tell other apps, registered in the swim school's module.ts.
 *
 *  Commitments (owner request, 12 November 2026: "we need the assessments that are booked to be
 *  visible on the plan what's on"): each assessment session that is not cancelled and has someone
 *  booked on it, for its assessor, so Plan shows it in its area under What's on, and the Rota in
 *  its area. A session nobody is booked on needs nobody, so it is left out; so is a booking that
 *  was cancelled. Times, the kind and how many are booked only: never who. */
export const ASSESSMENT_SESSIONS = "activities.assessments";

/** A booking that makes the session one to staff: anything but a cancelled one (a child who did
 *  not come was still booked, so a past day keeps the session). */
const BOOKED = { status: { not: "CANCELLED" } } as const;

export async function assessmentCommitments(query: CommitmentQuery): Promise<Commitment[]> {
  const rows = await prisma.assessmentSession.findMany({
    where: {
      date: { gte: parseDateOnly(query.from), lte: parseDateOnly(query.to) }, cancelledAt: null, bookings: { some: BOOKED },
      ...(query.siteIds ? { clubId: { in: [...query.siteIds] } } : {}),
      ...(query.userIds ? { instructorId: { in: [...query.userIds] } } : {}),
    },
    orderBy: [{ date: "asc" }, { startMinutes: "asc" }, { id: "asc" }],
    select: { id: true, clubId: true, date: true, startMinutes: true, durationMinutes: true, location: true, instructorId: true,
      programme: { select: { name: true } }, type: { select: { name: true } }, _count: { select: { bookings: { where: BOOKED } } } },
  });
  return rows.map((s) => {
    const title = `Assessment: ${s.type?.name ?? s.programme.name} (${plural(s._count.bookings, "booked", "booked")})`;
    const place = s.location?.trim() || undefined;
    return {
      source: ASSESSMENT_SESSIONS, module: "Swim school", userId: s.instructorId, siteId: s.clubId, date: s.date.toISOString().slice(0, 10),
      startMinutes: s.startMinutes, endMinutes: s.startMinutes + s.durationMinutes, title, place,
      label: place ? `${title}, ${place}` : title, href: `/assessments/${s.id}`, ref: s.id,
    };
  });
}

/** Plan who assesses a session on its day: the session's assessor, the one the swim school shows. */
export async function planAssessor({ ref, siteId, date, userId, by }: CommitmentPlan): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isDateOnly(date)) return { ok: false, error: "Choose a date." };
  const session = await prisma.assessmentSession.findFirst({
    where: { id: ref, clubId: siteId, date: parseDateOnly(date) },
    select: { id: true, cancelledAt: true, instructorId: true, programmeId: true, programme: { select: { name: true } }, type: { select: { name: true } } },
  });
  if (!session) return { ok: false, error: "That assessment is no longer on that day." };
  if (session.cancelledAt) return { ok: false, error: "That assessment was cancelled." };
  const assessor = userId ? (await staffByIds([userId])).get(userId) : null;
  if (userId && !assessor) return { ok: false, error: "That person is no longer active." };
  if (session.instructorId === userId) return { ok: true };
  await prisma.$transaction(async (tx) => {
    await tx.assessmentSession.update({ where: { id: ref }, data: { instructorId: userId } });
    await logAudit({ actorId: by.id, actorName: by.name, action: "update", entity: "AssessmentSession", entityId: ref, programmeId: session.programmeId, clubId: siteId,
      summary: `Planned the ${session.type?.name ?? session.programme.name} assessment on ${date} with ${assessor?.name ?? "nobody yet"}` }, tx);
  });
  return { ok: true };
}
