import "server-only";
import { sitesFor } from "@/lib/policy/session";
import { prisma } from "@/lib/prisma";
import { members } from "@/modules/contributions";
import { inSites } from "@/modules/payments/shared/access";

/** Payments tracks swimmers only (owner, 2 November 2026), but sheets uploaded before that added
 *  gym memberships and unknown member numbers too. These are the payments at the sites this person
 *  manages with no swimmer behind them: those whose member number is a swimmer's now are to link,
 *  the rest to remove. Null while the swim school is off, as nobody can be checked. */
export async function nonSwimmerPlan(orgId: string | null) {
  const directory = await members();
  if (!directory) return null;
  const sites = await sitesFor("payments.manage");
  if (sites.kind === "some" && sites.siteIds.size === 0) return { link: [], remove: [] };
  const unlinked = await prisma.paymentFailure.findMany({
    where: { orgId: orgId ?? undefined, memberId: null, ...inSites(sites) },
    select: { id: true, orgId: true, siteId: true, month: true, memberNumber: true, name: true, amountCents: true, status: true, attempts: true },
  });
  const swimmers = await directory.byNumbers(unlinked.map((f) => f.memberNumber).filter(Boolean));
  const link = unlinked.flatMap((f) => { const s = swimmers.get(f.memberNumber); return s ? [{ ...f, memberId: s.id }] : []; });
  const remove = unlinked.filter((f) => !swimmers.has(f.memberNumber));
  return { link, remove };
}

/** What the Failed payments page offers Manage: how many to remove, and how many of them reception
 *  has already worked on (their history goes too). */
export async function nonSwimmerCounts(orgId: string | null) {
  const plan = await nonSwimmerPlan(orgId);
  if (!plan) return null;
  return { remove: plan.remove.length, worked: plan.remove.filter((f) => f.attempts > 0 || f.status !== "to_contact").length, link: plan.link.length };
}
