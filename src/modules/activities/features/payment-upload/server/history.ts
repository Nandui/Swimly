import "server-only";
import { sitesFor } from "@/lib/policy/session";
import { prisma } from "@/lib/prisma";
import { inSites, requirePaymentsActor } from "@/modules/activities/shared/payments/access";

/** The latest failure sheets uploaded, for Manage's upload page: when, by whom, for which month,
 *  and how many of the payments each added are still on the list at the sites this person manages
 *  (what Remove this upload would take off), with how many reception has already worked on. */
export async function uploadHistory() {
  const who = await requirePaymentsActor();
  if (!who.manage) return [];
  const [imports, sites] = await Promise.all([
    prisma.paymentImport.findMany({ where: { orgId: who.orgId ?? undefined }, orderBy: { createdAt: "desc" }, take: 12,
      select: { id: true, month: true, fileName: true, added: true, uploadedByName: true, createdAt: true } }),
    sitesFor("payments.manage"),
  ]);
  if (!imports.length) return [];
  const rows = await prisma.paymentFailure.findMany({ where: { importId: { in: imports.map((i) => i.id) }, ...inSites(sites) },
    select: { importId: true, status: true, attempts: true } });
  return imports.map((i) => {
    const mine = rows.filter((r) => r.importId === i.id);
    return { ...i, createdAt: i.createdAt.toISOString(), onList: mine.length,
      worked: mine.filter((r) => r.attempts > 0 || r.status !== "to_contact").length };
  });
}
export type UploadHistoryRow = Awaited<ReturnType<typeof uploadHistory>>[number];
