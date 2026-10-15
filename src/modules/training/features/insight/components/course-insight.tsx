import Link from "next/link";
import { CircleDot, TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Tag } from "@/components/ui-kit/tag";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { formatDate } from "@/lib/format";
import type { StatusMeta } from "@/lib/status";
import { TRAINING_STATUS_META } from "@/modules/training/shared/constants";
import type { CourseInsight } from "@/modules/training/features/insight/server/data";
import { Bars, days, Figure, pct } from "@/modules/training/features/insight/components/parts";

const MAX_LEARNERS = 300;

/** A lesson people stopped before: the one most stopped at stands out. */
const STOP_META = {
  most: { label: "Most stopped here", color: "orange", icon: TriangleAlert },
  some: { label: "Stopped here", color: "gray", icon: CircleDot },
} as const satisfies Record<string, StatusMeta>;

/** One course's analytics for the people the reader covers (e-learning phase 7): how far they
 *  get, where they stop, how long it takes, how the exam goes and how each site is doing. */
export function CourseInsightView({ data }: { data: CourseInsight }) {
  const { funnel: f, dropOff: d, timing: t, exam: e } = data;
  if (!f.assigned) {
    return <EmptyState as="h2" icon="graduation" title="Nobody has this course yet" hint={data.filters.site || data.filters.period ? "No one you cover was given it with these filters." : "Its numbers show here once people you cover are given it."} />;
  }
  const steps = [
    { key: "assigned", label: "Given the course", count: f.assigned },
    { key: "started", label: "Started it", count: f.started },
    ...(d.lessons.length ? [{ key: "lessons", label: "Finished every lesson", count: f.lessonsDone }] : []),
    ...(data.hasExam ? [{ key: "exam", label: "Passed the final exam", count: f.examPassed }] : []),
    ...(data.course.requiresSignoff ? [{ key: "signoff", label: "Waiting for a practical sign-off", count: f.awaitingSignoff }] : []),
    { key: "completed", label: "Completed", count: f.completed },
  ];
  const worst = d.lessons.find((l) => l.lessonId === d.mostStopped);
  return (
    <div className="flex flex-col gap-6">
      <div className="pc-stats pc-stats-fill">
        <Figure value={pct(Math.round((f.completed / f.assigned) * 100))} label="Completed" hint={`${f.completed} of ${f.assigned} people${data.cancelled ? ` · ${data.cancelled} cancelled not counted` : ""}`} />
        <Figure value={data.overdue} label="Overdue now" hint={data.overdue ? "Past their due date and not handed in" : "Nobody is late"} />
        <Figure value={days(t.daysToFinish)} label="To finish" hint={t.daysLearning === null ? "The middle time from being given it" : `The middle time from being given it; ${days(t.daysLearning)} from the first lesson`} />
        <Figure value={pct(t.onTime)} label="On time" hint={t.dated ? `Of ${t.dated} completed with a due date` : "None completed with a due date yet"} />
        {data.hasExam ? <Figure value={pct(e.firstTime)} label="Passed the exam first time" hint={e.sat ? `${e.sat} sat it · middle best score ${e.medianBest === null ? "–" : `${e.medianBest}%`}` : "Nobody has sat it yet"} /> : null}
        <Figure value={data.rating.average === null ? "–" : `${data.rating.average} of 5`} label="Rating" hint={data.rating.count ? `From ${data.rating.count} ${data.rating.count === 1 ? "learner" : "learners"}, everyone who rated it` : "Nobody has rated it yet"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="insight-funnel" className="pc-panel">
          <div className="space-y-1">
            <h2 id="insight-funnel">How far people get</h2>
            <p className="text-sm text-ui-muted-foreground">Of everyone given it{data.filters.period && data.filters.period !== "all" ? " in this period" : ""}.</p>
          </div>
          <Bars of={f.assigned} items={steps.map((s) => ({ ...s, text: s.label }))} />
        </section>

        {data.hasExam ? (
          <section aria-labelledby="insight-exam" className="pc-panel">
            <div className="space-y-1">
              <h2 id="insight-exam">Final exam</h2>
              <p className="text-sm text-ui-muted-foreground">Of the {e.sat} {e.sat === 1 ? "person" : "people"} who sat it at least once.</p>
            </div>
            {e.sat ? (
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {([
                  ["Passed first time", pct(e.firstTime)],
                  ["Passed in the end", pct(e.passed)],
                  ["Middle best score", e.medianBest === null ? "–" : `${e.medianBest}%`],
                  ["Sittings to pass, on average", e.triesToPass ?? "–"],
                ] as const).map(([label, value]) => (
                  <div key={label} className="min-w-0 space-y-1">
                    <dt className="text-sm text-ui-muted-foreground">{label}</dt>
                    <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : <p className="text-sm text-ui-muted-foreground">Nobody has sat it yet.</p>}
            <Link href={`/training/courses/${data.course.id}?exam=1`} className="text-sm font-medium underline-offset-4 hover:underline">See the questions people miss most</Link>
          </section>
        ) : null}
      </div>

      {d.lessons.length ? (
        <section aria-labelledby="insight-stops" className="pc-panel">
          <div className="space-y-1">
            <h2 id="insight-stops">Where people stop</h2>
            <p className="text-sm text-ui-muted-foreground">
              {d.inProgress || d.notStarted
                ? `${d.inProgress} ${d.inProgress === 1 ? "person is" : "people are"} part way through and ${d.notStarted} ${d.notStarted === 1 ? "hasn't" : "haven't"} opened it.${worst ? ` Most stopped before “${worst.title}”: check it reads clearly and isn't too long.` : ""}`
                : "Nobody is part way through."}
              {data.minutes ? ` The lessons take about ${data.minutes} minutes in all.` : ""}
            </p>
          </div>
          <Bars of={f.assigned} items={d.lessons.map((l, i) => ({
            key: l.lessonId, text: l.title,
            label: <><span className="text-ui-muted-foreground tabular-nums">{i + 1}. </span>{l.title}<span className="text-ui-muted-foreground"> · {l.section}</span></>,
            count: l.reached,
            note: l.stoppedHere ? <Tag meta={STOP_META[l.lessonId === d.mostStopped ? "most" : "some"]} label={`${l.stoppedHere} stopped here`} /> : undefined,
          }))} />
        </section>
      ) : (
        <p className="text-sm text-ui-muted-foreground">{data.course.published ? "This course has no lessons." : "This course isn't published, so there are no lessons to follow yet."}</p>
      )}

      {data.bySite.length > 1 ? (
        <section aria-labelledby="insight-sites" className="pc-panel">
          <div className="space-y-1">
            <h2 id="insight-sites">By site</h2>
            <p className="text-sm text-ui-muted-foreground">Someone who works at two sites counts at both.</p>
          </div>
          <Table>
            <TableCaption className="sr-only">How each site is doing on this course</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col" className="p-3">Site</TableHead>
                <TableHead scope="col" className="p-3 text-right">Given</TableHead>
                <TableHead scope="col" className="p-3 text-right">Completed</TableHead>
                <TableHead scope="col" className="p-3 text-right">Overdue</TableHead>
                {data.hasExam ? <TableHead scope="col" className="p-3 text-right">Passed first time</TableHead> : null}
                <TableHead scope="col" className="p-3 text-right">To finish</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.bySite.map((s) => (
                <TableRow key={s.id}>
                  <TableHead scope="row" className="h-auto p-3 font-medium">{s.name}</TableHead>
                  <TableCell className="p-3 text-right tabular-nums">{s.assigned}</TableCell>
                  <TableCell className="p-3 text-right tabular-nums">{s.completed} · {pct(s.completion)}</TableCell>
                  <TableCell className="p-3 text-right tabular-nums">{s.overdue}</TableCell>
                  {data.hasExam ? <TableCell className="p-3 text-right tabular-nums">{pct(s.firstTime)}</TableCell> : null}
                  <TableCell className="p-3 text-right tabular-nums">{days(s.daysToFinish)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      ) : null}

      <section aria-labelledby="insight-people" className="pc-panel">
        <div className="space-y-1">
          <h2 id="insight-people">People</h2>
          <p className="text-sm text-ui-muted-foreground">Overdue first.{data.learners.length > MAX_LEARNERS ? ` The first ${MAX_LEARNERS} of ${data.learners.length}; the download has everyone.` : ""}</p>
        </div>
        <Table>
          <TableCaption className="sr-only">Each person given this course and where they are</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="p-3">Person</TableHead>
              <TableHead scope="col" className="p-3">Where they are</TableHead>
              <TableHead scope="col" className="p-3">Due</TableHead>
              <TableHead scope="col" className="p-3">Last activity</TableHead>
              {data.hasExam ? <TableHead scope="col" className="p-3 text-right">Best score</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.learners.slice(0, MAX_LEARNERS).map((l) => (
              <TableRow key={l.id}>
                <TableHead scope="row" className="h-auto p-3 font-medium">
                  <Link href={`/training/people/${l.userId}`} className="underline-offset-4 hover:underline">{l.name}</Link>
                  <span className="block text-xs font-normal text-ui-muted-foreground">{l.sites}</span>
                </TableHead>
                <TableCell className="p-3">
                  <span className="flex flex-wrap items-center gap-2">
                    {l.state === "assigned" ? <span className="text-sm">{l.stage}</span> : <Tag meta={TRAINING_STATUS_META[l.state]} />}
                    {l.state === "overdue" ? <span className="text-sm text-ui-muted-foreground">{l.stage.replace(", overdue", "")}</span> : null}
                  </span>
                  {l.completedAt ? <span className="block text-xs text-ui-muted-foreground">{formatDate(l.completedAt)}{l.days !== null ? ` · ${days(l.days)}` : ""}</span> : null}
                </TableCell>
                <TableCell className="p-3 text-sm tabular-nums">{l.dueOn ? formatDate(l.dueOn) : "–"}</TableCell>
                <TableCell className="p-3 text-sm tabular-nums">{l.lastActivity ? formatDate(l.lastActivity) : "Not opened"}</TableCell>
                {data.hasExam ? <TableCell className="p-3 text-right text-sm tabular-nums">{l.best === null ? "–" : `${l.best}%`}{l.attempts > 1 ? <span className="block text-xs text-ui-muted-foreground">{l.attempts} sittings</span> : null}</TableCell> : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
