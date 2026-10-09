import { AuthorizationError, canSee, requireSession } from "@/lib/authz";
import { currentClubId } from "@/lib/clubs/current";
import { parseDateOnly } from "@/lib/format";
import { prisma } from "@/lib/prisma";

/** Minimal status data only; no billing roster is exposed to schedule readers. */
export async function getCancellationsForDay(iso: string) {
  await requireSession();
  const rows = await prisma.classCancellation.findMany({
    where: { clubId: await currentClubId(), date: parseDateOnly(iso) },
    select: { id: true, courseId: true, reason: true },
  });
  return new Map(rows.map(row => [row.courseId, row]));
}

export async function getCancellation(courseId: string, iso: string) {
  await requireSession();
  return prisma.classCancellation.findFirst({
    where: { courseId, date: parseDateOnly(iso), clubId: await currentClubId() },
    select: { id: true, reason: true },
  });
}

/** One page of the billing follow-up list; the pager reads it back from the result. */
export const BILLING_PAGE_SIZE = 25;

export async function getBillingCancellations(notified: boolean, page: number) {
  const session = await requireSession();
  if (!canSee(session, "cancellations")) throw new AuthorizationError("Cancelled classes access is required.");
  const clubId = await currentClubId();
  const where = { clubId, billingNotifiedAt: notified ? { not: null } : null };
  const [total, pending] = await Promise.all([
    prisma.classCancellation.count({ where }),
    prisma.classCancellation.count({ where: { clubId, billingNotifiedAt: null } }),
  ]);
  const pageSize = BILLING_PAGE_SIZE;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(1, page), pages);
  const rows = await prisma.classCancellation.findMany({
    where, orderBy: [{ date: notified ? "desc" : "asc" }, { startMinutes: "asc" }, { id: "asc" }],
    skip: (currentPage - 1) * pageSize, take: pageSize,
    include: { swimmers: { orderBy: [{ swimmerName: "asc" }, { id: "asc" }] } },
  });
  return { rows, pending, total, pages, page: currentPage, pageSize };
}

/** Every cancellation in one billing view at this site, with each affected swimmer's name as on
 *  their record, for the Legend bulk update export (`bulk-log.ts`). */
export async function getBillingExport(notified: boolean) {
  const session = await requireSession();
  if (!canSee(session, "cancellations")) throw new AuthorizationError("Cancelled classes access is required.");
  const clubId = await currentClubId();
  const rows = await prisma.classCancellation.findMany({
    where: { clubId, billingNotifiedAt: notified ? { not: null } : null },
    orderBy: [{ date: "asc" }, { startMinutes: "asc" }, { id: "asc" }],
    select: { id: true, date: true, programmeName: true,
      swimmers: { select: { studentId: true, swimmerName: true, memberNumber: true, student: { select: { firstName: true, lastName: true, memberNumber: true } } } } },
  });
  return {
    session, clubId,
    cancellations: rows.map((c) => ({
      id: c.id, date: c.date, programmeName: c.programmeName,
      swimmers: c.swimmers.map((s) => ({ studentId: s.studentId, firstName: s.student.firstName, lastName: s.student.lastName, memberNumber: s.memberNumber ?? s.student.memberNumber })),
    })),
  };
}
