import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { ACADEMY_CALL_DUE_META, ACADEMY_CALL_META, ACADEMY_CALL_TIMES, type AcademyCallOutcome, type AcademyCallTime, CallDialog, toCall } from "@/modules/academy/features/calls";
import { formatDate, formatDateTime, plural } from "@/lib/format";

export const metadata: Metadata = { title: "Academy: to call" };

const times = (t: string[]) => (t.length ? t.map((x) => ACADEMY_CALL_TIMES[x as AcademyCallTime] ?? x).join(", ") : "Any time");
const outcome = (o: string) => (ACADEMY_CALL_META[o as AcademyCallOutcome]?.label ?? o).toLowerCase();

/** Who to phone for payment (owner decision, 8 October 2026): everyone who held a place on the
 *  booking site and still owes, soonest deadline first. We cannot take payment online, so reception
 *  phones within 72 hours. Overdue places stay held until someone records a call. */
export default async function AcademyCallsPage() {
  const { people, overdue, soon } = await toCall();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="To call for payment"
        description="People who held a place online. Phone them within 72 hours of holding it to take payment, soonest deadline first."
        status={people.length ? <>
          {overdue ? <Tag meta={ACADEMY_CALL_DUE_META.overdue} label={`${overdue} overdue`} /> : null}
          {soon ? <Tag meta={ACADEMY_CALL_DUE_META.soon} label={`${soon} due within a day`} /> : null}
          <Tag meta={ACADEMY_CALL_DUE_META.later} label={plural(people.length, "to call", "to call")} />
        </> : undefined} />
      <section className="pc-panel" aria-labelledby="calls-h">
        <div className="pc-panel-head"><h2 id="calls-h">To call</h2></div>
        {people.length === 0 ? <EmptyState compact icon="calendarCheck" title="Nobody to call" hint="When someone holds a place on the booking site, they show here until their payment is recorded." /> : (
          <ul className="pc-rows">
            {people.map((p) => {
              const last = p.calls[0];
              return (
                <li key={p.id} className="pc-row academy-call">
                  <span className="pc-row-body">
                    <span className="pc-row-title">{p.name}</span>
                    <span className="pc-row-hint">
                      <a href={`tel:${p.phone.replace(/[^\d+]/g, "")}`} className="tabular-nums">{p.phone}</a>
                      {` · best time ${times(p.callTimes).toLowerCase()}`}
                    </span>
                  </span>
                  <span className="pc-row-body">
                    <Link href={`/academy/${p.course.id}`} className="pc-row-title">{p.course.type.name}</Link>
                    <span className="pc-row-hint">{[p.course.site.name, p.first ? `from ${formatDate(new Date(`${p.first}T00:00:00Z`))}` : null].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="pc-row-body">
                    <span className="pc-row-hint">{p.calls.length ? `${plural(p.calls.length, "call")}: last ${outcome(last.outcome)}, ${formatDateTime(last.createdAt)}${last.note ? ` (${last.note})` : ""}` : "Not called yet"}</span>
                    <span className="pc-row-hint">Held {formatDateTime(p.createdAt)}{p.reference ? ` · ${p.reference}` : ""}</span>
                  </span>
                  <span className="pc-row-trail">
                    <Tag meta={ACADEMY_CALL_DUE_META[p.due]} label={p.due === "overdue" ? p.label : `Call by ${p.label}`} />
                    <CallDialog primary={p.due === "overdue"} course={`${p.course.type.name} at ${p.course.site.name}`} priceCents={p.course.priceCents}
                      person={{ id: p.id, name: p.name, phone: p.phone, phone2: p.phone2, callTimes: p.callTimes, reference: p.reference, heldAt: formatDateTime(p.createdAt),
                        calls: p.calls.map((c) => ({ outcome: c.outcome, byName: c.byName, at: formatDateTime(c.createdAt), note: c.note })) }} />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
