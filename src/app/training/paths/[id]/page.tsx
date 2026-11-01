import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { RecordSection } from "@/components/ui-kit/record";
import { Tag } from "@/components/ui-kit/tag";
import { formatDate } from "@/lib/format";
import { ARCHIVAL_STATUS_META } from "@/lib/status";
import { ArchivePath, EnrolInPath, LeavePath, pathDetail, PathDialog } from "@/modules/training/features/paths";
import { TRAINING_STATUS_META } from "@/modules/training/features/assignments";

export const metadata: Metadata = { title: "Learning path" };

/** One learning path: its courses in order and everyone on it, with where each
 *  person is. Who is listed follows the viewer's Training records reach. */
export default async function PathPage({ params }: { params: Promise<{ id: string }> }) {
  const data = await pathDetail((await params).id);
  if (!data) notFound();
  const { who, path, steps, rows, courses, assignable, summary } = data;
  return (
    <PageShell spacing="roomy" header={<PageHeader back={{ href: "/training/paths", label: "Learning paths" }} title={path.title}
        description={path.summary || `${steps.length} ${steps.length === 1 ? "course" : "courses"} in order.`}
        status={path.archived ? <Tag meta={ARCHIVAL_STATUS_META.archived} /> : null}
        actions={
          <>
            {who.manage ? <PathDialog courses={courses} path={{ id: path.id, title: path.title, summary: path.summary, steps: steps.map((s) => ({ courseId: s.courseId, dueDays: s.dueDays })) }} /> : null}
            {who.manage ? <ArchivePath id={path.id} title={path.title} archived={path.archived} /> : null}
            {who.assign && !path.archived ? <EnrolInPath pathId={path.id} title={path.title} people={assignable} /> : null}
          </>
        } />}>
      <RecordSection id="steps-heading" title="Courses" aside={<p>{steps.length}</p>}>
        <ol className="pc-list">
          {steps.map((s, i) => (
            <li key={s.courseId} className="pc-row">
              <span className="pc-tile-icon tabular-nums" aria-hidden="true">{i + 1}</span>
              <div className="pc-row-body">
                <Link href={`/training/courses/${s.courseId}`} className="pc-row-title -my-3 inline-flex min-h-11 items-center self-start underline-offset-4 hover:underline">{s.title}</Link>
                <p className="pc-row-hint">{s.dueDays === 0 ? "Due on their first day" : `Due ${s.dueDays} ${s.dueDays === 1 ? "day" : "days"} after they start`}{s.practical ? " · signed off in person" : ""}{s.archived ? " · course archived, skipped" : ""}</p>
              </div>
            </li>
          ))}
        </ol>
      </RecordSection>
      {rows.length === 0 ? (
        <EmptyState as="h2" icon="graduation" title="Nobody on this path" hint={who.assign ? "Put new starters on it to assign every course at once." : "Nobody you cover is on it."} />
      ) : (
        <RecordSection id="people-heading" title="People on it" aside={<p>{summary.enrolled}</p>} note={`${summary.finished} finished${summary.overdue ? ` · ${summary.overdue} behind` : ""}`}>
          <ul className="pc-list">
            {rows.map((row) => (
              <li key={row.id} className="pc-row flex-wrap">
                <div className="pc-row-body">
                  <Link href={`/training/people/${row.userId}`} className="pc-row-title -my-3 inline-flex min-h-11 items-center self-start underline-offset-4 hover:underline">{row.name}{row.jobTitle ? ` · ${row.jobTitle}` : ""}</Link>
                  <p className="pc-row-hint tabular-nums">Started {formatDate(row.startsOn)} · {row.done} of {row.total} done{row.finishedOn ? ` · finished ${formatDate(row.finishedOn)}` : ""}</p>
                  <ol className="mt-1 flex flex-wrap gap-2" aria-label={`${row.name}'s courses`}>
                    {row.states.map((state, i) => (
                      <li key={steps[i].courseId}>
                        <Tag meta={TRAINING_STATUS_META[state.state === "done" ? "completed" : state.state === "missing" ? "cancelled" : state.submitted ? "submitted" : state.overdue ? "overdue" : "assigned"]}
                          label={`${i + 1}. ${steps[i].title}`} />
                      </li>
                    ))}
                  </ol>
                </div>
                {who.assign ? <div className="pc-row-trail"><LeavePath enrolmentId={row.id} name={row.name} title={path.title} /></div> : null}
              </li>
            ))}
          </ul>
        </RecordSection>
      )}
    </PageShell>
  );
}
