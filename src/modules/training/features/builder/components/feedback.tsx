import { Star } from "lucide-react";
import { Progress } from "@/components/shadcn/progress";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { formatDate } from "@/lib/format";
import type { FeedbackReport } from "@/modules/training/features/builder/server/data";

/** What learners said once they finished (e-learning phase 6): the average
 *  rating, how many gave each, and what they found unclear. Never names. */
export function CourseFeedback({ report }: { report: FeedbackReport }) {
  return (
    <section className="flex min-w-0 flex-col" aria-labelledby="feedback-heading">
      <div className="pc-section-head"><h2 id="feedback-heading">What learners said</h2>{report.count ? <p>{report.count}</p> : null}</div>
      <p className="pc-section-note">Asked when someone finishes the course in Turnfin Me. Shown without names.</p>
      {report.count === 0 ? <div className="pc-list"><EmptyState compact icon="award" title="No ratings yet" /></div> : (
        <div className="rec-card gap-6">
          <div className="grid gap-6 md:grid-cols-auto-fill md:items-center">
            <div className="flex flex-col gap-1">
              <p className="text-figure">{report.average} <span className="text-sm font-normal text-ui-muted-foreground">out of 5</span></p>
              <p className="text-sm text-ui-muted-foreground">{report.count} {report.count === 1 ? "rating" : "ratings"}</p>
            </div>
            <ul className="flex flex-col gap-2" aria-label="Ratings by stars">
              {report.stars.map((s) => (
                <li key={s.stars} className="flex items-center gap-3 text-sm">
                  <span className="inline-flex w-20 shrink-0 items-center gap-1 tabular-nums">{s.stars} <Star className="size-4" aria-hidden="true" />{s.stars === 1 ? " star" : " stars"}</span>
                  <Progress className="flex-1" value={report.count ? Math.round((s.count / report.count) * 100) : 0} aria-label={`${s.stars} stars: ${s.count}`} />
                  <span className="w-8 shrink-0 text-right tabular-nums text-ui-muted-foreground">{s.count}</span>
                </li>
              ))}
            </ul>
          </div>
          {report.comments.length ? (
            <div className="flex flex-col gap-2">
              <h3 className="font-semibold">What was unclear</h3>
              <ul className="pc-rows">
                {report.comments.map((c, i) => (
                  <li key={i} className="pc-row">
                    <div className="pc-row-body">
                      <p className="whitespace-pre-line">{c.unclear}</p>
                      <p className="pc-row-hint tabular-nums">{c.rating} of 5 · {formatDate(c.on)}{c.version ? ` · version ${c.version}` : ""}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : <p className="text-sm text-ui-muted-foreground">Nobody has said anything was unclear.</p>}
        </div>
      )}
    </section>
  );
}
