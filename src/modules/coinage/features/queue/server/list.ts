import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { allSites } from "@/lib/directory";
import { requireCoinageActor } from "@/modules/coinage/shared/auth";
import { coinageView, coinageVisibility } from "@/modules/coinage/shared/data";
import { coinageStatuses } from "@/modules/coinage/shared/types";

export type CoinageFilters = { q?: string; site?: string; status?: string; creator?: string; handler?: string; page?: string };
/** The Coinage list: views, filters and the follow-up counts, as on the Refunds list. */
export async function listCoinage(filters: CoinageFilters) {
  const who = await requireCoinageActor();
  const status = filters.status || (who.review || who.process ? "actionable" : "open");
  const and: Prisma.CoinageRequestWhereInput[] = [coinageVisibility(who)];
  if (filters.site) and.push({ clubId: filters.site });
  if (filters.creator) and.push({ creatorId: filters.creator });
  if (filters.handler) and.push(filters.handler === "unassigned" ? { handlerId: null } : { handlerId: filters.handler });
  if (filters.q?.trim()) {
    const q = filters.q.trim().slice(0, 200), numeric = /^CO-\d+$/i.test(q) ? Number(q.slice(3)) : null;
    and.push({ OR: [{ forWhom: { contains: q, mode: "insensitive" } }, { creatorName: { contains: q, mode: "insensitive" } }, { orderReference: { contains: q, mode: "insensitive" } }, ...(numeric && numeric < 2147483647 ? [{ number: numeric }] : [])] });
  }
  const scope = { AND: [...and] };
  if (Object.hasOwn(coinageStatuses, status)) and.push({ status });
  else if (status === "actionable") and.push({ status: { in: [...(who.review ? ["SUBMITTED", "IN_REVIEW"] : []), ...(who.process ? ["APPROVED"] : []), ...(who.request ? ["NEEDS_INFORMATION"] : [])] } });
  else if (status === "review") and.push({ status: { in: ["SUBMITTED", "IN_REVIEW"] } });
  else if (status === "open") and.push({ status: { notIn: ["ORDERED", "DECLINED", "WITHDRAWN"] } });
  const where = { AND: and };
  const oldestFirst = status === "actionable" || status === "review";
  const [total, counts, people, sites] = await Promise.all([
    prisma.coinageRequest.count({ where }),
    prisma.coinageRequest.groupBy({ by: ["status"], where: scope, _count: { _all: true } }),
    prisma.coinageRequest.findMany({ where: coinageVisibility(who), distinct: ["creatorId", "handlerId"], select: { creatorId: true, creatorName: true, handlerId: true, handlerName: true } }),
    allSites(),
  ]);
  const pages = Math.max(1, Math.ceil(total / 25)), page = Math.min(pages, Math.max(1, Number.parseInt(filters.page || "1", 10) || 1));
  const rows = await prisma.coinageRequest.findMany({ where, orderBy: [{ submittedAt: oldestFirst ? "asc" : "desc" }, { createdAt: "desc" }, { id: "asc" }], skip: (page - 1) * 25, take: 25 });
  return { who, rows: rows.map(coinageView), total, counts: Object.fromEntries(counts.map(item => [item.status, item._count._all])), people, sites, page, pages, filters: { ...filters, status } };
}
