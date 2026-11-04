import "server-only";
import { addDaysIso, today } from "@/lib/format";
import { currentActor, sitesFor } from "@/lib/policy/session";
import { prisma } from "@/lib/prisma";
import { expandPermissions } from "@/lib/staff/permissions";
import type { HomeItem, HomeViewer } from "@/modules/contributions";
import { ackState, publishDeadline } from "@/modules/staffing/shared/rules";
import { dateOf, settingsFor } from "@/modules/staffing/shared/server";

type Sites = Awaited<ReturnType<typeof sitesFor>>;
const inSites = (sites: Sites) => (sites.kind === "all" ? {} : { siteId: { in: [...sites.siteIds] } });

/** Staffing on Home and its overview: what waits for the person at the sites where they may act.
 *  Return-to-work chats (Run), blocks to publish, swaps to decide and acknowledgements to chase
 *  (Supervise), and referrals (Manage). */
export async function staffingHomeItems(viewer: HomeViewer): Promise<HomeItem[]> {
  const held = expandPermissions(viewer.anywhere, { superadmin: viewer.isSuperadmin });
  if (!held.has("staffing.run")) return [];
  const day = today();
  const now = new Date();
  const items: HomeItem[] = [];
  const run = await sitesFor("staffing.run");
  const chats = await prisma.staffingStrike.count({ where: { ...inSites(run), handledAt: null, withdrawnAt: null, stage: "informal_1", dueOn: { lte: dateOf(addDaysIso(day, 1)) } } });
  if (chats) items.push({ label: "Return-to-work chats due", hint: "On their next shift", href: "/staffing/strikes", count: chats, attention: true });
  if (held.has("staffing.supervise")) {
    const sup = await sitesFor("staffing.supervise");
    const settings = await settingsFor((await currentActor()).orgId);
    const drafts = await prisma.staffingBlock.findMany({ where: { ...inSites(sup), publishedAt: null }, select: { startsOn: true } });
    const due = drafts.filter((b) => publishDeadline(b.startsOn.toISOString().slice(0, 10), settings).getTime() - now.getTime() < 7 * 86_400_000).length;
    if (due) items.push({ label: "Rota blocks to publish", hint: "Due by Friday 17:00", href: "/staffing", count: due, attention: true });
    const swaps = await prisma.staffingSwap.count({ where: { ...inSites(sup), status: "accepted" } });
    if (swaps) items.push({ label: "Swaps to decide", hint: "Within 24 hours", href: "/staffing/requests", count: swaps, attention: true });
    const acks = await prisma.staffingAck.findMany({ where: { acknowledgedAt: null, phonedAt: null, block: { ...inSites(sup), publishedAt: { not: null } } }, select: { block: { select: { publishedAt: true } } } });
    const phone = acks.filter((a) => ackState(a.block.publishedAt!, null, now, settings) === "phone").length;
    if (phone) items.push({ label: "Teachers to phone about the rota", hint: "Not acknowledged in 48 hours", href: "/staffing", count: phone, attention: true });
    const second = await prisma.staffingStrike.count({ where: { ...inSites(sup), handledAt: null, withdrawnAt: null, stage: "informal_2" } });
    if (second) items.push({ label: "Second strike conversations", hint: "Signed note", href: "/staffing/strikes", count: second, attention: true });
  }
  if (held.has("staffing.manage")) {
    const referrals = await prisma.staffingStrike.count({ where: { ...inSites(await sitesFor("staffing.manage")), handledAt: null, withdrawnAt: null, stage: { in: ["formal_referral", "serious_misconduct_referral"] } } });
    if (referrals) items.push({ label: "Referrals to HR", hint: "Strike 3 or no call, no show", href: "/staffing/strikes", count: referrals, attention: true });
  }
  return items;
}
