import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { History } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import {
  ABSENCE_REASON_META, BackAtWork, ExtendAbsence, RemoveAbsence, ReportAbsence, requireRotaActor, RETURN_FIT_META, ReturnToWork, type RotaAbsenceRow, rotaAbsences, type RotaReturnRow,
} from "@/modules/rota/features/absences";
import { Avatar, AvatarFallback } from "@/components/shadcn/avatar";
import { Button } from "@/components/shadcn/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/shadcn/collapsible";
import { Tag } from "@/components/ui-kit/tag";
import { formatDate, nameInitials, plural } from "@/lib/format";

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

/** One person in a section: their initials, name and tags, caption lines, and the actions at the
 *  end (full width under the text on narrow screens). An absence extended before carries its
 *  History, which opens under the row. */
function PersonRow({ name, tags, lines, actions, updates }: { name: string; tags?: React.ReactNode; lines: (string | null | false)[]; actions?: React.ReactNode; updates?: RotaAbsenceRow["updates"] }) {
  const history = updates?.some((u) => u.kind === "extended") ? updates : null;
  const body = (
    <>
      <Avatar size="lg" aria-hidden="true"><AvatarFallback>{nameInitials(name)}</AvatarFallback></Avatar>
      <span className="pc-row-body">
        <span className="flex flex-wrap items-center gap-2"><span className="pc-row-title">{name}</span>{tags}</span>
        {lines.filter(Boolean).map((line, i) => <span key={i} className="pc-row-hint">{line}</span>)}
      </span>
      {actions || history ? (
        <span className="pc-row-trail">
          {history ? <CollapsibleTrigger asChild><Button variant="ghost"><History aria-hidden="true" />History</Button></CollapsibleTrigger> : null}
          {actions}
        </span>
      ) : null}
    </>
  );
  if (!history) return <li className="pc-row">{body}</li>;
  return (
    <Collapsible asChild>
      <li className="pc-row">
        {body}
        <CollapsibleContent className="basis-full">
          <ol className="flex flex-col gap-1 border-l border-ui-border pl-3">
            {history.map((u) => (
              <li key={u.id} className="pc-row-hint">
                {formatDate(u.createdAt)}: {u.kind === "reported" ? "reported" : u.kind === "extended" ? "extended" : "back"}
                {u.kind !== "back" ? (u.lastDay ? ` until ${day(u.lastDay)}` : ", return not known") : u.lastDay ? ` after ${day(u.lastDay)}` : ""}
                {` by ${u.byName}`}{u.note ? ` · ${u.note}` : ""}
              </li>
            ))}
          </ol>
        </CollapsibleContent>
      </li>
    </Collapsible>
  );
}

/** A section of the page: a white panel with its heading, an optional caption, and its rows. */
function Panel({ id, title, hint, children }: { id: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="pc-panel">
      <div className="pc-panel-head">
        <div className="flex flex-col gap-1"><h2 id={id}>{title}</h2>{hint ? <p className="pc-row-hint">{hint}</p> : null}</div>
      </div>
      {children}
    </section>
  );
}

/** When the return to work is due: from their first shift back. */
function due(a: Pick<RotaReturnRow, "firstShift" | "stage">) {
  if (!a.firstShift) return "Nothing on the rota for them since, so it is due now";
  return a.stage === "due" ? `First day back ${day(new Date(`${a.firstShift}T00:00:00Z`))}, so it is due now` : `Due on their first day back, ${day(new Date(`${a.firstShift}T00:00:00Z`))}`;
}

/** Who is off (owner decision, 6 October 2026: the records stay in the main database and show on
 *  the person's HR file). The duty manager (Run) records absences here or from Today; the rota then
 *  shows the person's activities as needing cover, and Today lists them first. */
export default async function AbsencesPage({ searchParams }: { searchParams: Promise<{ report?: string }> }) {
  if (!(await requireRotaActor()).run) notFound();
  // Home's and This week's "Report an absence" arrive with ?report=1 and open the dialog.
  const report = (await searchParams).report === "1";
  const { today, current, returning, returned, people } = await rotaAbsences();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Absences" description="Who is off, and the days of work that need cover. Only people who run the rota see the reason. Each absence is on the person's HR file."
        actions={<ReportAbsence people={people} today={today} defaultOpen={report} />} />
      <Panel id="absences-current" title="Off now or soon">
        {current.length === 0 ? (
          <EmptyState compact icon="userX" title="Nobody you look after is off" hint="Among the people your rota role covers. When someone calls in sick or can’t come in, report it here or from Today." />
        ) : (
          <ul className="pc-rows">
            {current.map((a) => (
              <PersonRow key={a.id} name={a.user.name} tags={<Tag meta={ABSENCE_REASON_META[a.reason]} />} updates={a.updates}
                lines={[`${when(a)} · ${a.shiftsToCover ? plural(a.shiftsToCover, "day of work needs", "days of work need") + " cover" : "nothing on the rota affected"}`,
                  [`Reported by ${a.reportedByName}`, story(a) || null, a.updates.at(-1)?.note || a.note || null].filter(Boolean).join(" · ")]}
                actions={<>
                  <RemoveAbsence id={a.id} name={a.user.name} />
                  <ExtendAbsence id={a.id} name={a.user.name} firstDay={iso(a.firstDay)} lastDay={a.lastDay ? iso(a.lastDay) : null} today={today} />
                  <BackAtWork id={a.id} name={a.user.name} today={today} />
                </>} />
            ))}
          </ul>
        )}
      </Panel>
      {returning.length ? (
        <Panel id="absences-return" title="Return to work" hint="Back from an absence. Talk to them on their first day back and record it here; it goes on their personal file.">
          <ul className="pc-rows">
            {returning.map((a) => (
              <PersonRow key={a.id} name={a.user.name} tags={<Tag meta={ABSENCE_REASON_META[a.reason]} />}
                lines={[`${when(a)} · ${due(a)}`, story(a) || null]}
                actions={<ReturnToWork id={a.id} name={a.user.name} reason={a.reason} firstDay={iso(a.firstDay)} lastDay={iso(a.lastDay!)} today={today} />} />
            ))}
          </ul>
        </Panel>
      ) : null}
      {returned.length ? (
        <Panel id="absences-returned" title="Back in the last 30 days">
          <ul className="pc-rows">
            {returned.map((a) => (
              <PersonRow key={a.id} name={a.user.name} tags={<Tag meta={ABSENCE_REASON_META[a.reason]} />}
                lines={[[when(a), a.returnMetOn ? `return to work ${day(a.returnMetOn)}${a.returnByName ? ` with ${a.returnByName}` : ""}` : null, story(a) || null].filter(Boolean).join(" · ")]}
                actions={a.returnFit ? <Tag meta={RETURN_FIT_META[a.returnFit]} /> : undefined} />
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
