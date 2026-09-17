import type { Prisma } from "@/generated/prisma/client";
import { requireSession } from "@/lib/authz";
import { currentClubId } from "@/lib/clubs/current";
import { prisma } from "@/lib/prisma";
import { getSharedCurriculum } from "@/lib/curriculum/data/shared";

const PAGE_SIZE = 20;
export async function getLegendAgreements(input: { q?: string; view?: string; page?: number } = {}) {
  await requireSession();
  const clubId = await currentClubId();
  const q = (input.q ?? "").trim().slice(0, 100);
  const view = input.view === "done" ? "done" : "outstanding";
  // A billing check belongs to a class place, even when a swimmer has another
  // agreement at another site. Waitlists and ended places are not active bills.
  const base: Prisma.EnrolmentWhereInput = { status: "ACTIVE", course: { clubId },
    ...(q ? { student: { AND: q.split(/\s+/).map(term => ({ OR: [
      { firstName: { contains: term, mode: "insensitive" } },
      { lastName: { contains: term, mode: "insensitive" } },
      { memberNumber: { contains: term, mode: "insensitive" } },
    ] })) } } : {}),
  };
  const outstanding: Prisma.EnrolmentWhereInput = { ...base, legendAgreementStatus: { in: ["NEEDS_CHECK", "PENDING"] } };
  const done: Prisma.EnrolmentWhereInput = { ...base, legendAgreementStatus: "DONE" };
  const [outstandingCount, doneCount, club, curriculum] = await Promise.all([
    prisma.enrolment.count({ where: outstanding }), prisma.enrolment.count({ where: done }),
    prisma.club.findUniqueOrThrow({ where: { id: clubId }, select: { name: true } }), getSharedCurriculum(),
  ]);
  const total = view === "done" ? doneCount : outstandingCount;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number.isSafeInteger(input.page) ? input.page! : 1));
  const rows = await prisma.enrolment.findMany({
    where: view === "done" ? done : outstanding, take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE,
    orderBy: view === "done" ? [{ legendAgreementUpdatedAt: "desc" }, { id: "asc" }] : [{ startedOn: "asc" }, { id: "asc" }],
    select: {
      id: true, startedOn: true, legendAgreementStatus: true, legendAgreementUpdatedAt: true, legendAgreementUpdatedByName: true,
      student: { select: { id: true, firstName: true, lastName: true, memberNumber: true } },
      course: { select: { id: true, name: true, dayOfWeek: true, startMinutes: true, durationMinutes: true, archivedAt: true,
        level: { select: { id: true, name: true } } } },
    },
  });
  const items = rows.map(row => ({ ...row, course: { ...row.course, level: {
    ...row.course.level, name: curriculum.level(row.course.level.id)?.name ?? row.course.level.name,
  } } }));
  return { items, q, view, total, pages, page, outstandingCount, doneCount, siteName: club.name };
}
export type LegendAgreementResult = Awaited<ReturnType<typeof getLegendAgreements>>;
