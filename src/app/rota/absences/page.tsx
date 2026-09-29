import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UserX } from "lucide-react";
import { BackAtWork, RemoveAbsence, ReportAbsence } from "@/components/rota/absences";
import { AbsenceReasonTag } from "@/components/rota/status";
import { Tag } from "@/components/ui-kit/tag";
import { formatDate } from "@/lib/format";
import { ROSTER_LEAVE_META } from "@/lib/rota/constants";
import { requireRotaActor } from "@/lib/rota/access";
import { rotaAbsences, type RotaAbsenceRow } from "@/lib/rota/data";

export const metadata: Metadata = { title: "Absences" };

const day = (date: Date) => formatDate(new Date(`${date.toISOString().slice(0, 10)}T00:00:00Z`));
function when(a: Pick<RotaAbsenceRow, "firstDay" | "lastDay">) {
  if (!a.lastDay) return `From ${day(a.firstDay)}, return not known`;
  return a.lastDay.getTime() === a.firstDay.getTime() ? day(a.firstDay) : `${day(a.firstDay)} to ${day(a.lastDay)}`;
}

/** Roster holiday days, one line per person. */
function onHoliday(entries: { date: Date; kind: string; note: string; rotaPerson: { name: string } | null }[]) {
  const people = new Map<string, { name: string; label: string; days: string[] }>();
  for (const e of entries) {
    const name = e.rotaPerson?.name ?? "Someone";
    const label = e.kind === "holiday" ? ROSTER_LEAVE_META.holiday.label : e.note || ROSTER_LEAVE_META.leave.label;
    const row = people.get(name) ?? { name, label, days: [] };
    row.days.push(day(e.date));
    people.set(name, row);
  }
  return [...people.values()];
}

/** Who is off. Rota managers record absences here; the week shows the
 *  affected shifts as Absent so cover can be found. */
export default async function AbsencesPage() {
  if (!(await requireRotaActor()).manage) notFound();
  const { today, current, returned, people, holidays } = await rotaAbsences();
  return (
    <div className="space-y-6">
      <div className="module-heading">
        <div className="space-y-2">
          <h1>Absences</h1>
          <p className="text-sm">Who is off, and the shifts that need cover. Only rota managers see the reason.</p>
        </div>
        <ReportAbsence people={people} today={today} />
      </div>
      <section aria-labelledby="absences-current">
        <h2 id="absences-current" className="mb-3">Off now or soon</h2>
        {current.length === 0 ? (
          <div className="module-empty"><UserX aria-hidden="true" /><p className="font-semibold">Nobody is off</p><p className="mt-2 text-sm text-ui-muted-foreground">When someone calls in sick or can&apos;t come in, report it here.</p></div>
        ) : (
          <ul className="module-list">
            {current.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="flex flex-wrap items-center gap-2"><span className="module-row-title">{a.user.name}</span><AbsenceReasonTag reason={a.reason} /></p>
                  <p className="text-sm">{when(a)}{a.shiftsToCover ? ` · ${a.shiftsToCover} ${a.shiftsToCover === 1 ? "shift needs" : "shifts need"} cover` : " · no shifts affected"}</p>
                  <p className="text-xs text-ui-muted-foreground">{[`Reported by ${a.reportedByName}`, a.note || null].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <BackAtWork id={a.id} name={a.user.name} today={today} />
                  <RemoveAbsence id={a.id} name={a.user.name} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {holidays.length ? (
        <section aria-labelledby="absences-holiday">
          <h2 id="absences-holiday" className="mb-3">On holiday in the next two weeks</h2>
          <p className="mb-3 text-sm text-ui-muted-foreground">From the uploaded roster: planned, so nothing to report.</p>
          <ul className="module-list">
            {onHoliday(holidays).map((h) => (
              <li key={h.name} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <p className="flex flex-wrap items-center gap-2"><span className="module-row-title">{h.name}</span><Tag color={ROSTER_LEAVE_META.holiday.color}>{h.label}</Tag></p>
                <p className="text-sm text-ui-muted-foreground">{h.days.join(", ")}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {returned.length ? (
        <section aria-labelledby="absences-returned">
          <h2 id="absences-returned" className="mb-3">Back in the last 30 days</h2>
          <ul className="module-list">
            {returned.map((a) => (
              <li key={a.id} className="space-y-1 px-5 py-4">
                <p className="flex flex-wrap items-center gap-2"><span className="module-row-title">{a.user.name}</span><AbsenceReasonTag reason={a.reason} /></p>
                <p className="text-sm text-ui-muted-foreground">{when(a)}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
