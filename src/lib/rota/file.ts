import "server-only";
import { formatDate, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { ABSENCE_REASON_META, RETURN_FIT_META, addDaysIso, daysOff, type AbsenceReason, type ReturnFit } from "@/lib/rota/constants";
import { registerPersonFileSection, type PersonFileEntry } from "@/modules/contributions";

/** Rota's part of a person's file: every absence recorded for them, with its
 *  return to work, and how much they were off in the last 12 months. Their
 *  absences on the roster count once the roster entry is linked to their
 *  account. Withdrawn absences (recorded in error) are left out. */

const iso = (d: Date) => d.toISOString().slice(0, 10);
const day = (value: string) => formatDate(new Date(`${value}T00:00:00Z`));
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);

export async function absenceFile(userId: string, orgId: string): Promise<{ summary: string; entries: PersonFileEntry[] }> {
  const rows = await prisma.rotaAbsence.findMany({
    where: { orgId, withdrawnAt: null, OR: [{ userId }, { rotaPerson: { userId } }] },
    orderBy: { firstDay: "desc" },
    select: {
      id: true, reason: true, firstDay: true, lastDay: true, note: true, reportedByName: true,
      returnMetOn: true, returnFit: true, returnAdjustments: true, returnFitNote: true, returnNote: true, returnByName: true,
      continues: { select: { lastDay: true } },
      updates: { where: { kind: "extended" }, select: { id: true } },
    },
  });
  const now = today(), yearAgo = addDaysIso(now, -364);
  let days = 0, count = 0;
  const entries = rows.map((a): PersonFileEntry => {
    const first = iso(a.firstDay), last = a.lastDay ? iso(a.lastDay) : null;
    // The last 12 months: the days off within it, up to today.
    const to = [last ?? now, now].sort()[0], from = [first, yearAgo].sort().at(-1)!;
    if (to >= from) { days += daysOff(from, to); count++; }
    const reason = ABSENCE_REASON_META[a.reason as AbsenceReason]?.label ?? "Absence";
    const title = !last ? `${reason}, off since ${day(first)}`
      : `${reason}, ${last === first ? day(first) : `${day(first)} to ${day(last)}`} (${plural(daysOff(first, last), "day")})`;
    const ret = a.returnMetOn ? [
      `Return to work on ${day(iso(a.returnMetOn))}${a.returnByName ? ` with ${a.returnByName}` : ""}: ${RETURN_FIT_META[a.returnFit as ReturnFit]?.label.toLowerCase() ?? "recorded"}${a.returnAdjustments ? ` (${a.returnAdjustments})` : ""}`,
      a.returnFitNote === null ? null : a.returnFitNote ? "Fit note received" : "Fit note not received",
      a.returnNote || null,
    ] : [last ? "Return to work not recorded yet" : null];
    const detail = [
      `Reported by ${a.reportedByName}${a.note ? `: ${a.note}` : ""}`,
      a.updates.length ? `Extended ${times(a.updates.length)}` : null,
      a.continues ? `Off again after an absence ending ${a.continues.lastDay ? day(iso(a.continues.lastDay)) : "earlier"}` : null,
      ...ret,
    ].filter(Boolean).join(" · ");
    return { id: a.id, title, detail, on: first };
  });
  const summary = count ? `${plural(count, "absence")} in the last 12 months, ${plural(days, "calendar day")} off.` : "No absences in the last 12 months.";
  return { summary, entries };
}

registerPersonFileSection({ id: "rota.absences", heading: "Absences and returns to work", load: absenceFile });
