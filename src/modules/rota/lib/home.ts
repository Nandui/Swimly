import "server-only";
import { minutesNow, parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { currentClubIdIfAny } from "@/lib/clubs/current";
import { returnsToWorkDue } from "@/modules/rota/lib/absences";
import { rotaSites, todayAt } from "@/modules/rota/lib/data";
import { dayGaps } from "@/modules/rota/lib/day";
import { expandPermissions } from "@/lib/staff/permissions";
import { registerHomeCard, type HomeItem } from "@/modules/contributions";

/** The rota on the home page, for the working site: who is on today and how many gaps are left,
 *  and for the duty manager who is off and the returns to work to record. Everyone sees their
 *  own days in Turnfin Me. */
registerHomeCard({
  moduleId: "rota",
  async items(viewer) {
    const held = expandPermissions(viewer.anywhere, { superadmin: viewer.isSuperadmin });
    if (!held.has("rota.view")) return [];
    const run = held.has("rota.manage");
    const [{ sites }, working] = await Promise.all([rotaSites(), currentClubIdIfAny()]);
    const site = sites.find((s) => s.id === working) ?? sites[0];
    if (!site) return [];
    const data = await todayAt(site.id);
    if (!data.site) return [];
    const on = data.day.people.length;
    // The gaps still to come, as Today counts them.
    const now = minutesNow();
    const gaps = dayGaps(data.day).filter((g) => g.end > now).length;
    const items: HomeItem[] = [{
      kind: "today", label: `On the rota at ${site.name}`, href: `/rota/today?site=${site.id}`, count: on,
      hint: gaps ? `${gaps} ${gaps === 1 ? "gap" : "gaps"} to fill` : on ? "No gaps left today" : "Nothing planned today",
      attention: run && gaps > 0,
    }];
    if (run) {
      const day = parseDateOnly(today());
      const off = await prisma.rotaAbsence.count({ where: { orgId: data.who.orgId ?? undefined, withdrawnAt: null, userId: { in: data.day.people.map((p) => p.userId) }, firstDay: { lte: day }, OR: [{ lastDay: null }, { lastDay: { gte: day } }] } });
      items.push({ kind: "today", icon: "userX", label: "Off today", href: `/rota/today?site=${site.id}`, count: off, hint: "On the rota today and off" });
      items.push({ kind: "action", icon: "userX", label: "Report an absence", href: "/rota/absences?report=1" });
      const returns = await returnsToWorkDue();
      if (returns) items.push({ label: "Returns to work to record", hint: "They are back at work", href: "/rota/absences#absences-return", count: returns, attention: true });
    }
    return items;
  },
});
