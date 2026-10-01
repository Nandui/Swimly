import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UserX } from "lucide-react";
import { BackAtWork, ExtendAbsence, RemoveAbsence, ReportAbsence, ReturnToWork } from "@/components/rota/absences";
import { AbsenceReasonTag, ReturnFitTag } from "@/components/rota/status";
import { Button } from "@/components/shadcn/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/shadcn/collapsible";
import { Tag } from "@/components/ui-kit/tag";
import { formatDate } from "@/lib/format";
import { ROSTER_LEAVE_META } from "@/lib/rota/constants";
import { requireRotaActor } from "@/lib/rota/access";
import { rotaAbsences, type RotaAbsenceRow, type RotaReturnRow } from "@/lib/rota/data";

export const metadata: Metadata = { title: "Absences" };

const day = (date: Date) => formatDate(new Date(`${date.toISOString().slice(0, 10)}T00:00:00Z`));
function when(a: Pick<RotaAbsenceRow, "firstDay" | "lastDay">) {
  if (!a.lastDay) return `From ${day(a.firstDay)}, return not known`;
  return a.lastDay.getTime() === a.firstDay.getTime() ? day(a.firstDay) : `${day(a.firstDay)} to ${day(a.lastDay)}`;
}

const iso = (date: Date) => date.toISOString().slice(0, 10);
const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);

/** How the absence got here: "First reported until 2 Oct · extended twice" and,
 *  when it is the same thing again, the earlier absence it follows. */
function story(a: Pick<RotaAbsenceRow, "updates" | "extensions" | "continues">) {
  const first = a.updates.find((u) => u.kind === "reported");
  const parts: string[] = [];
  if (a.extensions) parts.push(`Extended ${times(a.extensions)}${first ? `; first reported ${first.lastDay ? `until ${day(first.lastDay)}` : "with the return not known"}` : ""}`);
  if (a.continues) parts.push(`Off again after ${a.continues.lastDay ? `an absence ending ${day(a.continues.lastDay)}` : "an earlier absence"}`);
  return parts.join(" · ");
}

/** Each extension, newest last, with who recorded it and their note. */
function Updates({ updates }: { updates: RotaAbsenceRow["updates"] }) {
  const extended = updates.filter((u) => u.kind === "extended");
  if (!extended.length) return null;
  return (
    <Collapsible className="text-xs text-ui-muted-foreground">
      <CollapsibleTrigger asChild>
        <Button variant="link" size="sm" className="h-auto min-h-8 p-0! text-xs">History</Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
      <ol className="mt-1 space-y-1 border-l border-ui-border pl-3">
        {updates.map((u) => (
          <li key={u.id}>
            {formatDate(u.createdAt)}: {u.kind === "reported" ? "reported" : u.kind === "extended" ? "extended" : "back"}
            {u.kind !== "back" ? (u.lastDay ? ` until ${day(u.lastDay)}` : ", return not known") : u.lastDay ? ` after ${day(u.lastDay)}` : ""}
            {` by ${u.byName}`}{u.note ? ` · ${u.note}` : ""}
          </li>
        ))}
      </ol>
      </CollapsibleContent>
    </Collapsible>
  );
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

/** When the return to work is due: from their first shift back. */
function due(a: Pick<RotaReturnRow, "firstShift" | "stage">) {
  if (!a.firstShift) return "No shift on the rota since, so it is due now";
  return a.stage === "due" ? `First shift back ${day(new Date(`${a.firstShift}T00:00:00Z`))}, so it is due now` : `Due on their first shift back, ${day(new Date(`${a.firstShift}T00:00:00Z`))}`;
}

/** Who is off. Rota managers record absences here; the week shows the
 *  affected shifts as Absent so cover can be found. */
export default async function AbsencesPage() {
  if (!(await requireRotaActor()).manage) notFound();
  const { today, current, returning, returned, people, holidays } = await rotaAbsences();
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
                  <p className="text-xs text-ui-muted-foreground">{[`Reported by ${a.reportedByName}`, story(a) || null, a.updates.at(-1)?.note || a.note || null].filter(Boolean).join(" · ")}</p>
                  <Updates updates={a.updates} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <ExtendAbsence id={a.id} name={a.user.name} firstDay={iso(a.firstDay)} lastDay={a.lastDay ? iso(a.lastDay) : null} today={today} />
                  <BackAtWork id={a.id} name={a.user.name} today={today} />
                  <RemoveAbsence id={a.id} name={a.user.name} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {returning.length ? (
        <section aria-labelledby="absences-return-heading" id="absences-return">
          <h2 id="absences-return-heading" className="mb-3">Return to work</h2>
          <p className="mb-3 text-sm text-ui-muted-foreground">Back from an absence. Talk to them on their first shift back and record it here; it goes on their personal file.</p>
          <ul className="module-list">
            {returning.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="flex flex-wrap items-center gap-2"><span className="module-row-title">{a.user.name}</span><AbsenceReasonTag reason={a.reason} /></p>
                  <p className="text-sm">{when(a)} · {due(a)}</p>
                  {story(a) ? <p className="text-xs text-ui-muted-foreground">{story(a)}</p> : null}
                </div>
                <ReturnToWork id={a.id} name={a.user.name} reason={a.reason} firstDay={iso(a.firstDay)} lastDay={iso(a.lastDay!)} today={today} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
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
                <p className="flex flex-wrap items-center gap-2"><span className="module-row-title">{a.user.name}</span><AbsenceReasonTag reason={a.reason} />{a.returnFit ? <ReturnFitTag fit={a.returnFit} /> : null}</p>
                <p className="text-sm text-ui-muted-foreground">{[when(a), a.returnMetOn ? `return to work ${day(a.returnMetOn)}${a.returnByName ? ` with ${a.returnByName}` : ""}` : null, story(a) || null].filter(Boolean).join(" · ")}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
