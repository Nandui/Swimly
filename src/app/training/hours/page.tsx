import type { Metadata } from "next";
import Link from "next/link";
import { Progress } from "@/components/shadcn/progress";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { formatDate } from "@/lib/format";
import { HourTargetDialog, hoursInWords, hoursOverview, LogHours, RemoveHours, RemoveHourTarget } from "@/modules/training/features/hours";

export const metadata: Metadata = { title: "In-service hours" };

/** In-service hours (e-learning phase 5): what each qualification needs, who
 *  is on track, and the log. Limited to the people the viewer covers. */
export default async function HoursPage() {
  const { who, summaries, types, log, loggable } = await hoursOverview();
  return (
    <>
      <PageHeader title="In-service hours" description="Training hours against what each qualification needs, such as the 20 hours a year a pool lifeguard needs to stay qualified. Sessions add hours when their register is closed."
        actions={
          <>
            {who.manage ? <HourTargetDialog types={types} /> : null}
            {who.signoff && loggable.length ? <LogHours people={loggable} types={types} /> : null}
          </>
        } />
      {summaries.length === 0 ? (
        <EmptyState as="h2" icon="hourglass" title="No qualification needs hours yet" hint={who.manage ? "Set how many in-service hours a qualification needs, for example 20 hours in 12 months." : "Someone with the Author level in Training sets them."} />
      ) : summaries.map((t) => (
        <section key={t.typeId} className="pc-panel" aria-labelledby={`target-${t.typeId}`}>
          <div className="pc-panel-head">
            <div className="flex flex-col gap-1">
              <h2 id={`target-${t.typeId}`}>{t.typeName}</h2>
              <p className="text-sm text-ui-muted-foreground">{t.hours} {t.hours === 1 ? "hour" : "hours"} in every {t.windowMonths} {t.windowMonths === 1 ? "month" : "months"} · {t.met} of {t.rows.length} on track</p>
            </div>
            {who.manage ? (
              <div className="flex gap-1">
                <HourTargetDialog types={types} current={types.find((x) => x.id === t.typeId)} />
                <RemoveHourTarget typeId={t.typeId} name={t.typeName} />
              </div>
            ) : null}
          </div>
          {t.rows.length === 0 ? <p className="text-sm text-ui-muted-foreground">Nobody you cover holds it in date.</p> : (
            <ul className="pc-rows">
              {t.rows.map((r) => (
                <li key={r.userId} className="pc-row flex-wrap">
                  <div className="pc-row-body">
                    <Link href={`/training/people/${r.userId}`} className="pc-row-title -my-3 inline-flex min-h-11 items-center self-start underline-offset-4 hover:underline">{r.name}{r.jobTitle ? ` · ${r.jobTitle}` : ""}</Link>
                    <p className="pc-row-hint tabular-nums">{hoursInWords(r.minutes)} of {t.hours} h since {formatDate(r.since)}{r.met ? " · done" : ` · ${hoursInWords(r.needed - r.minutes)} to go`}</p>
                  </div>
                  <div className="pc-row-trail w-full sm:w-auto sm:min-w-(--pc-field-min)">
                    <Progress value={r.percent} aria-label={`${r.name}: ${r.percent}% of the hours`} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <section className="pc-panel" aria-labelledby="log-heading">
        <h2 id="log-heading">Recent hours</h2>
        {log.length === 0 ? <p className="text-sm text-ui-muted-foreground">No hours logged yet for the people you cover.</p> : (
          <ul className="pc-rows">
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
      </section>
    </>
  );
}
