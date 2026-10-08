import "server-only";
import { formatDate, parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { addDaysIso, clock } from "@/lib/rota/constants";
import { registerProfileSummary } from "@/modules/contributions";

/** The rota on someone's Staff page: what they are planned on in the next two weeks. */
registerProfileSummary({
  id: "rota.summary",
  heading: "Rota",
  async load(userId) {
    const from = today();
    const rows = await prisma.rotaAssignment.findMany({
      where: { userId, need: { date: { gte: parseDateOnly(from), lte: parseDateOnly(addDaysIso(from, 13)) } } },
      orderBy: [{ need: { date: "asc" } }, { startMinutes: "asc" }],
      select: { startMinutes: true, endMinutes: true, need: { select: { date: true, place: true, site: { select: { name: true } }, type: { select: { name: true } } } } },
    });
    const days = new Set(rows.map((r) => r.need.date.toISOString().slice(0, 10))).size;
    return {
      summary: rows.length ? `${rows.length} ${rows.length === 1 ? "activity" : "activities"} on ${days} ${days === 1 ? "day" : "days"} in the next two weeks` : "Nothing planned in the next two weeks",
      lines: rows.slice(0, 6).map((r) => ({ label: `${formatDate(r.need.date)}, ${clock(r.startMinutes)}–${clock(r.endMinutes)}`, hint: [r.need.type.name, r.need.place || null, r.need.site.name].filter(Boolean).join(" · ") })),
      href: "/rota",
    };
  },
});
