import { requireSession } from "@/lib/authz";
import { currentClubId } from "@/lib/clubs/current";
import { HOLDS_A_PLACE } from "@/lib/assessments/constants";
import { getSharedCurriculum } from "@/lib/curriculum/data/shared";
import { isDateOnly, parseDateOnly } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { CalendarAssessment } from "./calendar";

/** Schedule-only data for Today: no booking identities, outcomes or notes. */
export async function getTodayAssessments(iso: string): Promise<CalendarAssessment[]> {
  await requireSession();
  if (!isDateOnly(iso)) return [];
  const rows = await prisma.assessmentSession.findMany({
    where: { clubId: await currentClubId(), date: parseDateOnly(iso), cancelledAt: null },
    orderBy: [{ startMinutes: "asc" }, { id: "asc" }],
    select: {
      id: true, startMinutes: true, durationMinutes: true, location: true, capacity: true,
      instructorId: true, instructor: { select: { id: true, name: true } },
      programme: { select: { id: true, name: true } },
      type: { select: { id: true, name: true } },
      _count: { select: { bookings: { where: { status: { in: HOLDS_A_PLACE } } } } },
    },
  });
  if (!rows.length) return [];
  const curriculum = await getSharedCurriculum();
  return rows.map(({ programme, type, _count, ...row }) => ({
    ...row,
    programmeName: curriculum.programme(programme.id)?.name ?? programme.name,
    typeName: type ? curriculum.types.find(t => t.id === curriculum.typeIds.resolve(type.id))?.name ?? type.name : null,
    booked: _count.bookings,
  }));
}
