import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCheck, ClipboardCheck, Hourglass, Search, TriangleAlert } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { AssignTraining } from "@/components/training/manage-actions";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Tag } from "@/components/ui-kit/tag";
import { TRAINING_STATUS_META } from "@/lib/training/constants";
import { formatDate } from "@/lib/format";
import { assignablePeople, trainingOverview, OVERVIEW_VIEWS } from "@/lib/training/data";

export const metadata: Metadata = { title: "Training" };

export default async function TrainingOverviewPage({ searchParams }: { searchParams: Promise<{ view?: string; course?: string; q?: string }> }) {
  const input = await searchParams;
  const data = await trainingOverview(input);
  const people = data.who.assign ? await assignablePeople() : [];
  const activeCourses = data.courses.filter((c) => !c.archivedAt).map(({ id, title }) => ({ id, title }));
  const tiles = [
    { label: "Overdue", value: data.counts.overdue, icon: TriangleAlert, href: "/training?view=overdue" },
    { label: "Awaiting sign-off", value: data.counts.submitted, icon: ClipboardCheck, href: data.who.signoff ? "/training/sign-off" : "/training?view=submitted" },
    { label: "Qualifications expiring", value: data.counts.expiring, icon: Hourglass, href: "/training/expiring" },
    { label: "Completed in 30 days", value: data.counts.completed, icon: CheckCheck, href: "/training?view=completed" },
  ];
  return (
    <div className="space-y-6">
      <div className="module-heading">
        <div className="space-y-2">
          <h1>Training</h1>
          <p className="text-sm">Training for the people you cover: what is due, waiting for sign-off and done.</p>
        </div>
        {data.who.assign && activeCourses.length > 0 && people.length > 0 ? <AssignTraining courses={activeCourses} people={people} /> : null}
      </div>

      <dl className="module-summary grid grid-cols-2 gap-6 sm:grid-cols-4">
        {tiles.map(({ label, value, icon: Icon, href }) => (
          <div key={label}><Link href={href}><dt><Icon aria-hidden="true" />{label}</dt><dd>{value}</dd></Link></div>
        ))}
      </dl>

      <form method="get" className="module-filters space-y-4" role="search" aria-label="Filter training">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="min-w-0 space-y-2"><Label htmlFor="training-q">Person</Label><Input id="training-q" name="q" defaultValue={input.q ?? ""} placeholder="Name" className="min-h-11" /></div>
          <div className="min-w-0 space-y-2"><Label htmlFor="training-view">Show</Label>
            <NativeSelect id="training-view" name="view" defaultValue={data.view} className="min-h-11 w-full">
              {Object.entries(OVERVIEW_VIEWS).map(([value, label]) => <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>)}
            </NativeSelect>
          </div>
          <div className="min-w-0 space-y-2"><Label htmlFor="training-course">Course</Label>
            <NativeSelect id="training-course" name="course" defaultValue={input.course ?? ""} className="min-h-11 w-full">
              <NativeSelectOption value="">All courses</NativeSelectOption>
              {data.courses.map((c) => <NativeSelectOption key={c.id} value={c.id}>{c.title}</NativeSelectOption>)}
            </NativeSelect>
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="submit" className="min-h-11"><Search aria-hidden="true" />Apply filters</Button>
          <Button asChild variant="ghost" className="min-h-11"><Link href="/training">Reset</Link></Button>
        </div>
      </form>

      <div className="module-results space-y-3">
        <p className="text-sm">{data.total} {data.total === 1 ? "record" : "records"}{data.total > data.rows.length ? `, showing the first ${data.rows.length}` : ""}</p>
        {data.rows.length === 0 ? (
          <EmptyState as="h2" icon="graduation" title="Nothing to show" hint={`Try another filter${data.who.assign ? ", or assign a course" : ""}.`} />
        ) : (
          <ul className="module-list">
            {data.rows.map((row) => (
              <li key={row.id}>
                <Link href={`/training/people/${row.user.id}`} className="module-row flex min-h-20 flex-wrap items-center justify-between gap-4 p-4 sm:px-5">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2"><span className="module-row-title">{row.user.name}</span><Tag meta={TRAINING_STATUS_META[row.state]} /></div>
                    <p className="text-sm">{row.course.title}{row.user.jobTitle ? <span className="text-ui-muted-foreground"> · {row.user.jobTitle}</span> : null}</p>
                    <p className="text-xs text-ui-muted-foreground">
                      {row.state === "completed" && row.completedAt
                        ? `Completed ${formatDate(row.completedAt)}${row.signedOffByName ? ` · signed off by ${row.signedOffByName}` : ""}`
                        : `Assigned ${formatDate(row.assignedAt)} · ${row.dueOn ? `due ${formatDate(row.dueOn)}` : "no deadline"}`}
                    </p>
                  </div>
                  <ArrowRight className="module-row-arrow size-5" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
