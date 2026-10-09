import "server-only";
import { formatDate, parseDateOnly, plural, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { ABSENCE_REASON_META, RETURN_FIT_META, ROTA_CHANGE_REASON_META, addDaysIso, clock, daysOff, type AbsenceReason, type ReturnFit, type RotaChangeReason } from "@/modules/rota/lib/constants";
import { registerPersonFileSection, type PersonFileEntry } from "@/modules/contributions";

/** Rota's part of a person's file: what they are planned on in the next two
 *  weeks; every absence recorded for them, with its
 *  return to work, and how much they were off in the last 12 months; and the
 *  changes made to their activities on days that had come. Withdrawn absences
 *  (recorded in error) are left out. Absences recorded on the retired roster
 *  upload still count once its entry was linked to their account. */

const iso = (d: Date) => d.toISOString().slice(0, 10);
const day = (value: string) => formatDate(new Date(`${value}T00:00:00Z`));
/** A free-text note joined into a " · " line drops its own closing full stop. */
const clause = (text: string | null) => text?.trim().replace(/\.+$/, "") || null;
const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);

export async function plannedFile(userId: string): Promise<{ summary: string; entries: PersonFileEntry[] }> {
  const from = today();
  const rows = await prisma.rotaAssignment.findMany({
    where: { userId, need: { date: { gte: parseDateOnly(from), lte: parseDateOnly(addDaysIso(from, 13)) } } },
    orderBy: [{ need: { date: "asc" } }, { startMinutes: "asc" }],
    select: { id: true, startMinutes: true, endMinutes: true, need: { select: { date: true, place: true, site: { select: { name: true } }, type: { select: { name: true } } } } },
  });
  const days = new Set(rows.map((r) => iso(r.need.date))).size;
  return {
    summary: rows.length ? `${plural(rows.length, "activity", "activities")} on ${plural(days, "day")} in the next two weeks.` : "Nothing planned in the next two weeks.",
    entries: rows.map((r): PersonFileEntry => ({
      id: r.id,
      title: `${day(iso(r.need.date))}, ${clock(r.startMinutes)}–${clock(r.endMinutes)}`,
      detail: [r.need.type.name, r.need.place || null, r.need.site.name].filter(Boolean).join(" · "),
      on: iso(r.need.date),
    })),
  };
}

registerPersonFileSection({ id: "rota.planned", heading: "Rota", load: plannedFile });

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
      clause(a.returnNote),
    ] : [last ? "Return to work not recorded yet" : null];
    const detail = [
      `Reported by ${a.reportedByName}`,
      clause(a.note),
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

/** Changes to their activities on a day that had come (today or earlier): put on or taken off,
 *  with the reason, who changed it, and whether Timepoint has it. */
export async function dutyChangeFile(userId: string, orgId: string): Promise<{ summary: string; entries: PersonFileEntry[] }> {
  const rows = await prisma.rotaLog.findMany({
    where: { orgId, userId }, orderBy: { createdAt: "desc" }, take: 200,
    select: { id: true, date: true, summary: true, reason: true, note: true, byName: true, createdAt: true, timepointAt: true },
  });
  const yearAgo = addDaysIso(today(), -364);
  const recent = rows.filter((r) => iso(r.date) >= yearAgo).length;
  const entries = rows.map((r): PersonFileEntry => ({
    id: r.id,
    title: r.summary,
    detail: [
      ROTA_CHANGE_REASON_META[r.reason as RotaChangeReason]?.label ?? r.reason,
      `by ${r.byName} on ${day(iso(r.createdAt))}`,
      clause(r.note),
      r.timepointAt ? "In Timepoint" : "Not yet in Timepoint",
    ].filter(Boolean).join(" · "),
    on: iso(r.date),
  }));
  return { summary: recent ? `${plural(recent, "change")} to their activities in the last 12 months.` : "No changes to their activities in the last 12 months.", entries };
}

registerPersonFileSection({ id: "rota.changes", heading: "Changes to their activities", load: dutyChangeFile });
