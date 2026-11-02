import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { liveSitesOf, siteName, withSites } from "@/lib/directory";
import { mayFor, sitesFor } from "@/lib/policy/session";
import { prisma } from "@/lib/prisma";
import { members } from "@/modules/contributions";
import { covers, inSites, requirePaymentsActor } from "@/modules/payments/shared/access";
import { MONTH, PaymentError } from "@/modules/payments/shared/rules";
import { paymentView } from "@/modules/payments/shared/service";
import { monthLabel, OPEN_STATUSES, type PaymentAction, type PaymentHistory } from "@/modules/payments/shared/types";

export const VIEWS = ["to_contact", "contacted", "closed"] as const;
export type View = (typeof VIEWS)[number];
const PAGE = 25;

/** The lists on /payments, at the sites this person sees: those nobody has contacted yet, oldest
 *  month first; those contacted and waiting on the member, longest-waiting first; and the closed
 *  ones, newest first. One view at a time, paged, narrowed by site, month or a search for a name,
 *  member number or reference, with every view's count for the switcher. */
export async function paymentLists(params: { show?: string; site?: string; month?: string; q?: string; page?: string }) {
  const who = await requirePaymentsActor();
  const [sites, allSites, months] = await Promise.all([
    sitesFor("payments.read"), liveSitesOf(who.orgId),
    prisma.paymentImport.findMany({ where: { orgId: who.orgId ?? undefined }, distinct: ["month"], orderBy: { month: "desc" }, take: 24, select: { month: true } }),
  ]);
  const mySites = allSites.filter((s) => covers(sites, s.id)).map(({ id, name }) => ({ id, name }));
  const site = mySites.some((s) => s.id === params.site) ? params.site! : "";
  const month = params.month && MONTH.test(params.month) ? params.month : "";
  const q = (params.q ?? "").trim().slice(0, 80);
  const base: Prisma.PaymentFailureWhereInput = {
    orgId: who.orgId ?? undefined, ...inSites(sites), ...(site ? { siteId: site } : {}), ...(month ? { month } : {}),
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { memberNumber: { contains: q.replace(/\s+/g, ""), mode: "insensitive" } }, { reference: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const where: Record<View, Prisma.PaymentFailureWhereInput> = {
    to_contact: { ...base, status: "to_contact" },
    contacted: { ...base, status: "contacted" },
    closed: { ...base, status: { notIn: [...OPEN_STATUSES] } },
  };
  const show: View = VIEWS.includes(params.show as View) ? params.show as View : "to_contact";
  const orderBy: Record<View, Prisma.PaymentFailureOrderByWithRelationInput[]> = {
    to_contact: [{ month: "asc" }, { name: "asc" }], contacted: [{ lastContactAt: "asc" }], closed: [{ closedAt: "desc" }],
  };
  const [counts, owed] = await Promise.all([
    Promise.all(VIEWS.map(async (v) => [v, await prisma.paymentFailure.count({ where: where[v] })] as const)).then((c) => Object.fromEntries(c) as Record<View, number>),
    prisma.paymentFailure.aggregate({ where: { ...base, status: { in: [...OPEN_STATUSES] } }, _sum: { amountCents: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(counts[show] / PAGE));
  const page = Math.min(pages, Math.max(1, Number.parseInt(params.page || "1", 10) || 1));
  const rows = await prisma.paymentFailure.findMany({ where: where[show], orderBy: [...orderBy[show], { id: "asc" }], skip: (page - 1) * PAGE, take: PAGE });
  const named = await withSites(rows, "siteId", "site");
  return {
    who, show, counts, page, pages, site, month, q, sites: mySites, owedCents: owed._sum.amountCents ?? 0,
    months: months.map((m) => ({ value: m.month, label: monthLabel(m.month) })),
    rows: named.map((r) => paymentView(r, r.site.name)),
  };
}

/** One failure, for anyone who sees payments at its site; "not available" otherwise. The swimmer
 *  holding its member number (their contact, from the swim school's records), the member's other
 *  failures, and what this person may do on it ride along. */
export async function getPaymentFailure(id: string) {
  const who = await requirePaymentsActor();
  const row = await prisma.paymentFailure.findFirst({ where: { id, orgId: who.orgId ?? undefined } });
  if (!row || !(await mayFor("payments.read", { siteId: row.siteId, orgId: who.orgId }))) throw new PaymentError("This payment is not available.");
  const [follow, manage, site, events, others, directory, sites] = await Promise.all([
    mayFor("payments.follow", { siteId: row.siteId, orgId: who.orgId }),
    mayFor("payments.manage", { siteId: row.siteId, orgId: who.orgId }),
    siteName(row.siteId),
    prisma.paymentFailureEvent.findMany({ where: { failureId: id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true, action: true, actorName: true, method: true, result: true, note: true, createdAt: true } }),
    row.memberNumber ? prisma.paymentFailure.findMany({ where: { orgId: row.orgId, memberNumber: row.memberNumber, id: { not: id } }, orderBy: { month: "desc" }, take: 12 }) : [],
    members(),
    sitesFor("payments.read"),
  ]);
  const member = row.memberId && directory ? (await directory.byIds([row.memberId], { medical: false })).get(row.memberId) ?? null : null;
  const history: PaymentHistory[] = events.map((e) => ({ ...e, action: e.action as PaymentAction, createdAt: e.createdAt.toISOString() }));
  const seen = others.filter((o) => covers(sites, o.siteId));
  return {
    who, failure: paymentView(row, site), history,
    member: member ? { id: member.id, name: `${member.firstName} ${member.lastName}`, memberNumber: member.memberNumber, active: member.active,
      contactName: member.contactName, contactPhone: member.contactPhone, contactEmail: member.contactEmail } : null,
    others: (await withSites(seen, "siteId", "site")).map((o) => paymentView(o, o.site.name)),
    can: { follow, manage },
  };
}

/** What waits on reception at the sites this person follows up, for Home and the starter page. */
export async function followUpCounts(orgId: string | null) {
  const sites = await sitesFor("payments.follow");
  const where = { orgId: orgId ?? undefined, ...inSites(sites) };
  const [toContact, contacted] = await Promise.all([
    prisma.paymentFailure.count({ where: { ...where, status: "to_contact" } }),
    prisma.paymentFailure.count({ where: { ...where, status: "contacted" } }),
  ]);
  return { toContact, contacted };
}

/** A swimmer's failures still open, as badges on their profile (the member notices plug). The
 *  swim school's page has already checked its own access; these are a month and a link only. */
export async function memberPaymentNotices(memberId: string) {
  const rows = await prisma.paymentFailure.findMany({ where: { memberId, status: { in: [...OPEN_STATUSES] } }, orderBy: { month: "asc" }, select: { id: true, month: true } });
  return rows.map((r) => ({ id: r.id, label: "Payment failed", hint: `${monthLabel(r.month)} direct debit not recovered yet`, href: `/payments/${r.id}`, module: "Payments" }));
}
