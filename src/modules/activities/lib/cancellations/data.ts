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

/** The billing follow-up's stages (owner decision, 9 October 2026): awaiting billing; sent to
 *  Legend and waiting to be put back on the monthly price after the direct debit run; done
 *  (restored, or notified by hand before the Legend export existed). `true`/`false` are the
 *  old notified/awaiting views. */
export type BillingView = "awaiting" | "restore" | "done";
export const billingViewOf = (value: unknown): BillingView => (value === "restore" || value === "done" ? value : value === "notified" ? "done" : "awaiting");

function viewWhere(clubId: string, view: BillingView) {
  if (view === "awaiting") return { clubId, billingNotifiedAt: null };
  if (view === "restore") return { clubId, legendProcessedAt: { not: null }, restoredAt: null };
  return { clubId, billingNotifiedAt: { not: null }, OR: [{ legendProcessedAt: null }, { restoredAt: { not: null } }] };
}

export async function getBillingCancellations(viewInput: BillingView | boolean, page: number) {
  const session = await requireSession();
  if (!canSee(session, "cancellations")) throw new AuthorizationError("Cancelled classes access is required.");
  const view: BillingView = viewInput === true ? "done" : viewInput === false ? "awaiting" : viewInput;
  const clubId = await currentClubId();
  const where = viewWhere(clubId, view);
  const [total, pending, restore, ids] = await Promise.all([
    prisma.classCancellation.count({ where }),
    prisma.classCancellation.count({ where: viewWhere(clubId, "awaiting") }),
    prisma.classCancellation.count({ where: viewWhere(clubId, "restore") }),
    prisma.classCancellation.findMany({ where, orderBy: [{ date: "asc" }, { startMinutes: "asc" }, { id: "asc" }], select: { id: true } }),
  ]);
  const pageSize = BILLING_PAGE_SIZE;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(1, page), pages);
  const rows = await prisma.classCancellation.findMany({
    where, orderBy: [{ date: view === "done" ? "desc" : "asc" }, { startMinutes: "asc" }, { id: "asc" }],
    skip: (currentPage - 1) * pageSize, take: pageSize,
    include: { swimmers: { orderBy: [{ swimmerName: "asc" }, { id: "asc" }] } },
  });
  return { view, rows, pending, restore, total, pages, page: currentPage, pageSize, ids: ids.map((r) => r.id) };
}

/** The swim school's price list: each Legend agreement price and its monthly price. */
export async function getLegendPrices() {
  await requireSession();
  return prisma.legendAgreementPrice.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, monthlyCents: true, updatedAt: true, updatedByName: true } });
}

/** The cancellations being exported, with each affected swimmer's name as on their record, for
 *  the Legend bulk update (`bulk-log.ts`). Only these ids, and only those still in the view, so
 *  the file and the confirmation after it name the same classes. */
export async function getBillingExport(view: BillingView, ids: readonly string[]) {
  const session = await requireSession();
  if (!canSee(session, "cancellations")) throw new AuthorizationError("Cancelled classes access is required.");
  const clubId = await currentClubId();
  const [rows, prices] = await Promise.all([
    prisma.classCancellation.findMany({
      where: { ...viewWhere(clubId, view), ...(ids.length ? { id: { in: [...ids] } } : {}) },
      orderBy: [{ date: "asc" }, { startMinutes: "asc" }, { id: "asc" }],
      select: { id: true, date: true, programmeName: true,
        swimmers: { select: { studentId: true, swimmerName: true, memberNumber: true, student: { select: { firstName: true, lastName: true, memberNumber: true } } } } },
    }),
    prisma.legendAgreementPrice.findMany({ select: { name: true, monthlyCents: true } }),
  ]);
  return {
    session, clubId,
    cycleFees: new Map(prices.map((p) => [p.name, p.monthlyCents])),
    cancellations: rows.map((c) => ({
      id: c.id, date: c.date, programmeName: c.programmeName,
      swimmers: c.swimmers.map((s) => ({ studentId: s.studentId, firstName: s.student.firstName, lastName: s.student.lastName, memberNumber: s.memberNumber ?? s.student.memberNumber })),
    })),
  };
}
