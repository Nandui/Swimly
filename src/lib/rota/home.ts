import "server-only";
import { parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { rotaSites } from "@/lib/rota/data";
import { expandPermissions } from "@/lib/staff/permissions";
import { registerHomeCard, type HomeItem } from "@/modules/contributions";

/** The rota on the home page: who is on today at the sites this person may
 *  see, and for managers the shifts whose person is off. Everyone sees their
 *  own shifts in Turnfin Me. */
registerHomeCard({
  moduleId: "rota",
  async items(viewer) {
    const held = expandPermissions(viewer.anywhere, { superadmin: viewer.isSuperadmin });
    if (!held.has("rota.view")) return [];
    const manage = held.has("rota.manage");
    const { sites } = await rotaSites();
    const day = parseDateOnly(today());
    const shifts = sites.length ? await prisma.rotaShift.findMany({
      where: { siteId: { in: sites.map((s) => s.id) }, cancelledAt: null, date: day },
      select: { userId: true },
    }) : [];
    const people = [...new Set(shifts.flatMap((s) => (s.userId ? [s.userId] : [])))];
    const off = people.length ? new Set((await prisma.rotaAbsence.findMany({
      where: { userId: { in: people }, withdrawnAt: null, firstDay: { lte: day }, OR: [{ lastDay: null }, { lastDay: { gte: day } }] },
      select: { userId: true },
    })).map((a) => a.userId)) : new Set<string>();
    const uncovered = shifts.filter((s) => !s.userId || off.has(s.userId)).length;
    const items: HomeItem[] = [{
      kind: "today", label: "On shift today", href: "/rota", count: shifts.length - uncovered,
      hint: shifts.length === 0 ? "No shifts planned today" : uncovered ? `${uncovered} ${uncovered === 1 ? "shift needs" : "shifts need"} cover` : "Every shift has someone",
      attention: manage && uncovered > 0,
    }];
    if (manage) {
      items.push({ kind: "action", icon: "userX", label: "Report an absence", href: "/rota/absences" });
      items.push({ label: "Plan this week's shifts", href: "/rota" }, { label: "Absences", hint: "Who is off, now and soon", href: "/rota/absences" });
    } else {
      items.push({ label: "This week's rota", href: "/rota" });
    }
    return items;
  },
});
