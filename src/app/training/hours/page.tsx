import type { Metadata } from "next";
import Link from "next/link";
import { Progress } from "@/components/shadcn/progress";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { RecordSection } from "@/components/ui-kit/record";
import { formatDate } from "@/lib/format";
import { HourTargetDialog, hoursInWords, hoursOverview, LogHours, RemoveHours, RemoveHourTarget } from "@/modules/training/features/hours";

export const metadata: Metadata = { title: "In-service hours" };

/** In-service hours (e-learning phase 5): what each qualification needs, who
 *  is on track, and the log. Limited to the people the viewer covers. */
export default async function HoursPage() {
  const { who, summaries, types, log, loggable } = await hoursOverview();
  return (
    <PageShell spacing="roomy" header={<PageHeader title="In-service hours" description="Training hours against what each qualification needs, such as the 20 hours a year a pool lifeguard needs to stay qualified. Sessions add hours when their register is closed."
        actions={
          <>
            {who.manage ? <HourTargetDialog types={types} /> : null}
            {who.signoff && loggable.length ? <LogHours people={loggable} types={types} /> : null}
          </>
        } />}>
      {summaries.length === 0 ? (
        <EmptyState as="h2" icon="hourglass" title="No qualification needs hours yet" hint={who.manage ? "Set how many in-service hours a qualification needs, for example 20 hours in 12 months." : "Someone with the Author level in Training sets them."} />
      ) : summaries.map((t) => (
        <RecordSection key={t.typeId} id={`target-${t.typeId}`} title={t.typeName}
          aside={who.manage ? (
            <div className="flex gap-1">
              <HourTargetDialog types={types} current={types.find((x) => x.id === t.typeId)} />
              <RemoveHourTarget typeId={t.typeId} name={t.typeName} />
            </div>
          ) : <p>{t.met} of {t.rows.length}</p>}
          note={`${t.hours} ${t.hours === 1 ? "hour" : "hours"} in every ${t.windowMonths} ${t.windowMonths === 1 ? "month" : "months"} · ${t.met} of ${t.rows.length} on track`}>
          {t.rows.length === 0 ? <div className="pc-list"><EmptyState compact icon="hourglass" title="Nobody you cover holds it in date" /></div> : (
            <ul className="pc-list">
              {t.rows.map((r) => (
                <li key={r.userId} className="pc-row flex-wrap">
                  <div className="pc-row-body">
                    <Link href={`/training/people/${r.userId}`} className="pc-row-title -my-3 inline-flex min-h-11 items-center self-start underline-offset-4 hover:underline">{r.name}{r.jobTitle ? ` · ${r.jobTitle}` : ""}</Link>
                    <p className="pc-row-hint tabular-nums">{hoursInWords(r.minutes)} of {t.hours} h since {formatDate(r.since)}{r.met ? " · done" : ` · ${hoursInWords(r.needed - r.minutes)} to go`}</p>
                  </div>
                  <div className="pc-row-trail w-full sm:w-auto sm:min-w-(--field-min)">
                    <Progress value={r.percent} aria-label={`${r.name}: ${r.percent}% of the hours`} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </RecordSection>
      ))}
      <RecordSection id="log-heading" title="Recent hours">
        {log.length === 0 ? <div className="pc-list"><EmptyState compact icon="hourglass" title="No hours logged yet" hint="Hours logged for the people you cover appear here." /></div> : (
          <ul className="pc-list">
            {log.map((l) => (
              <li key={l.id} className="pc-row">
                <div className="pc-row-body">
                  <span className="pc-row-title">{l.name} · {hoursInWords(l.minutes)}</span>
                  <p className="pc-row-hint">{formatDate(l.on)} · {l.topic}{l.typeName ? ` · ${l.typeName}` : " · general"} · {l.sessionId ? "from a session register" : `logged by ${l.recordedByName}`}</p>
                </div>
                {l.canRemove ? <div className="pc-row-trail"><RemoveHours id={l.id} name={l.name} topic={l.topic} /></div> : null}
              </li>
            ))}
          </ul>
        )}
      </RecordSection>
    </PageShell>
  );
}
