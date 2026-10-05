import "server-only";
import { parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { currentClubIdIfAny } from "@/lib/clubs/current";
import { returnsToWorkDue, rotaSites } from "@/lib/rota/data";
import { samePerson } from "@/lib/rota/constants";
import { expandPermissions } from "@/lib/staff/permissions";
import { registerHomeCard, type HomeItem } from "@/modules/contributions";

/** The rota on the home page: who is on today at the working site (or at the
 *  sites this person may see), and for managers who is off and the returns to
 *  work to record. Everyone sees their own shifts in Turnfin Me. */
registerHomeCard({
  moduleId: "rota",
  async items(viewer) {
    const held = expandPermissions(viewer.anywhere, { superadmin: viewer.isSuperadmin });
    if (!held.has("rota.view")) return [];
    const manage = held.has("rota.manage");
    const [{ sites }, working] = await Promise.all([rotaSites(), currentClubIdIfAny()]);
    // The figures sit under "Today at <working site>", so they count that site when the person
    // covers it, and say "at your sites" when they count the sites the person covers instead.
    const here = sites.some((s) => s.id === working);
    const counted = here ? sites.filter((s) => s.id === working) : sites;
    const day = parseDateOnly(today());
    const shifts = counted.length ? await prisma.rotaShift.findMany({
      where: { siteId: { in: counted.map((s) => s.id) }, kind: "shift", cancelledAt: null, date: day },
      select: { userId: true, rotaPersonId: true },
    }) : [];
    const users = [...new Set(shifts.flatMap((s) => (s.userId ? [s.userId] : [])))];
    const entries = [...new Set(shifts.flatMap((s) => (s.rotaPersonId ? [s.rotaPersonId] : [])))];
    const someone = [...(users.length ? [{ userId: { in: users } }] : []), ...(entries.length ? [{ rotaPersonId: { in: entries } }] : [])];
    const off = someone.length ? await prisma.rotaAbsence.findMany({
      where: { OR: someone, withdrawnAt: null, firstDay: { lte: day }, AND: [{ OR: [{ lastDay: null }, { lastDay: { gte: day } }] }] },
      select: { userId: true, rotaPersonId: true },
    }) : [];
    const uncovered = shifts.filter((s) => (!s.userId && !s.rotaPersonId) || off.some((a) => samePerson(a, s))).length;
    const items: HomeItem[] = [{
      kind: "today", label: here ? "On shift" : "On shift at your sites", href: "/rota/day", count: shifts.length - uncovered,
      hint: shifts.length === 0 ? "No shifts planned today" : uncovered ? `${uncovered} uncovered` : "Every shift has someone",
      attention: manage && uncovered > 0,
    }];
    if (manage) {
      // Only people rostered today are looked at, so the hint says so.
      const offPeople = new Set(off.map((a) => a.userId ?? `entry:${a.rotaPersonId}`)).size;
      items.push({ kind: "today", icon: "userX", label: "Off today", href: "/rota/absences", count: offPeople, hint: "Rostered today and off" });
      items.push({ kind: "action", icon: "userX", label: "Report an absence", href: "/rota/absences?report=1" });
      const returns = await returnsToWorkDue();
      if (returns) items.push({ label: "Returns to work to record", hint: "They are back on shift", href: "/rota/absences#absences-return", count: returns, attention: true });
    }
    return items;
  },
});
