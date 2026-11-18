import "server-only";
import { liveSitesWithin } from "@/lib/directory";
import { addDaysIso, today } from "@/lib/format";
import { currentActor, sitesFor } from "@/lib/policy/session";
import { prisma } from "@/lib/prisma";
import { expandPermissions } from "@/lib/staff/permissions";
import type { HomeItem, HomeViewer } from "@/modules/contributions";
import { ackState, CHECK_APPLY_DAYS, preferenceChecks, publishDeadline, type StaffingSettings } from "@/modules/staffing/shared/rules";
import { dateOf, preferencesAt, settingsFor } from "@/modules/staffing/shared/server";

type Sites = Awaited<ReturnType<typeof sitesFor>>;
const inSites = (sites: Sites) => (sites.kind === "all" ? {} : { siteId: { in: [...sites.siteIds] } });

/** Everyone on the rota at the sites a level reaches, once each, with the times they gave. */
async function preferencesWithin(orgId: string | null, sites: Sites, settings: StaffingSettings, day: string) {
  const rows = (await Promise.all((await liveSitesWithin(orgId, sites)).map((site) => preferencesAt(orgId, site.id, settings, day)))).flat();
  return [...new Map(rows.map((p) => [p.id, p])).values()];
}

/** Staffing on Home and its overview: what waits for the person at the sites where they may act.
 *  Return-to-work chats (Run), blocks to publish, swaps to decide, acknowledgements to chase and
 *  changed times to use after a preference check (Supervise), and referrals and people whose
 *  times cannot fit their contracted hours (Manage). */
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
    const orgId = (await currentActor()).orgId;
    const settings = await settingsFor(orgId);
    const drafts = await prisma.staffingBlock.findMany({ where: { ...inSites(sup), publishedAt: null }, select: { startsOn: true } });
    const due = drafts.filter((b) => publishDeadline(b.startsOn.toISOString().slice(0, 10), settings).getTime() - now.getTime() < 7 * 86_400_000).length;
    if (due) items.push({ label: "Rota blocks to publish", hint: "Due by Friday 17:00", href: "/staffing", count: due, attention: true });
    const swaps = await prisma.staffingSwap.count({ where: { ...inSites(sup), status: "accepted" } });
    if (swaps) items.push({ label: "Swaps to decide", hint: "Within 24 hours", href: "/staffing/requests", count: swaps, attention: true });
    const acks = await prisma.staffingAck.findMany({ where: { acknowledgedAt: null, phonedAt: null, block: { ...inSites(sup), publishedAt: { not: null } } }, select: { block: { select: { publishedAt: true } } } });
    const phone = acks.filter((a) => ackState(a.block.publishedAt!, null, now, settings) === "phone").length;
    if (phone) items.push({ label: "Staff to phone about the rota", hint: "Not acknowledged in 48 hours", href: "/staffing", count: phone, attention: true });
    const second = await prisma.staffingStrike.count({ where: { ...inSites(sup), handledAt: null, withdrawnAt: null, stage: "informal_2" } });
    if (second) items.push({ label: "Second strike conversations", hint: "Signed note", href: "/staffing/strikes", count: second, attention: true });
    // Once a preference check has closed, its changes wait until the rota that Friday is out.
    const { current } = preferenceChecks(day, settings);
    if (current && now.getTime() > current.closesAt.getTime() && day <= addDaysIso(current.closesOn, CHECK_APPLY_DAYS)) {
      const changed = (await preferencesWithin(orgId, sup, settings, day)).filter((p) => p.change === "in_check").length;
      if (changed) items.push({ label: "Staff changed when they can work", hint: "Use them in the next rota", href: "/staffing/availability", count: changed, attention: true });
    }
  }
  if (held.has("staffing.manage")) {
    const referrals = await prisma.staffingStrike.count({ where: { ...inSites(await sitesFor("staffing.manage")), handledAt: null, withdrawnAt: null, stage: { in: ["formal_referral", "serious_misconduct_referral"] } } });
    if (referrals) items.push({ label: "Referrals to HR", hint: "Strike 3 or no call, no show", href: "/staffing/strikes", count: referrals, attention: true });
    const orgId = (await currentActor()).orgId;
    const short = (await preferencesWithin(orgId, await sitesFor("staffing.manage"), await settingsFor(orgId), day)).filter((p) => p.fit?.short).length;
    if (short) items.push({ label: "Staff whose times can't fit their contract", hint: "Meet them", href: "/staffing/availability", count: short, attention: true });
  }
  return items;
}
