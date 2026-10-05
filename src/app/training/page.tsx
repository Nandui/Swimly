import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, CircleCheck, ClipboardCheck, GraduationCap, TriangleAlert } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/shadcn/avatar";
import { Button } from "@/components/shadcn/button";
import { Label } from "@/components/shadcn/label";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { AssignTraining } from "@/components/training/manage-actions";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { SearchField } from "@/components/ui-kit/search-field";
import { Tag } from "@/components/ui-kit/tag";
import { EXPIRY_WARNING_DAYS, TRAINING_STATUS_META } from "@/lib/training/constants";
import { formatDate, nameInitials, plural } from "@/lib/format";
import { assignablePeople, trainingOverview, OVERVIEW_VIEWS } from "@/lib/training/data";

export const metadata: Metadata = { title: "Training" };

export default async function TrainingOverviewPage({ searchParams }: { searchParams: Promise<{ view?: string; course?: string; q?: string }> }) {
  const input = await searchParams;
  const data = await trainingOverview(input);
  const people = data.who.assign ? await assignablePeople() : [];
  const activeCourses = data.courses.filter((c) => !c.archivedAt).map(({ id, title }) => ({ id, title }));
  const tiles = [
    { view: "overdue", label: "Overdue", hint: "Past their due date", value: data.counts.overdue, icon: TriangleAlert, href: "/training?view=overdue" },
    { view: "submitted", label: "Awaiting sign-off", hint: "Ready to be watched", value: data.counts.submitted, icon: ClipboardCheck, href: data.who.signoff ? "/training/sign-off" : "/training?view=submitted" },
    { view: null, label: "Qualifications expiring", hint: `In the next ${EXPIRY_WARNING_DAYS} days`, value: data.counts.expiring, icon: GraduationCap, href: "/training/expiring" },
    { view: "completed", label: "Completed in 30 days", hint: "By the people you cover", value: data.counts.completed, icon: CircleCheck, href: "/training?view=completed" },
  ];
  const filtered = Boolean(input.q?.trim() || input.course);
  const empty = filtered
    ? { title: "Nothing matches", hint: "Try another name or course, or reset the filters." }
    : EMPTY[data.view];
  return (
    <>
      <PageHeader
        title="Training"
        description="Training for the people you cover: what is due, waiting for sign-off and done."
        actions={data.who.assign && activeCourses.length > 0 && people.length > 0 ? <AssignTraining courses={activeCourses} people={people} /> : null}
      />

      <ul className="pc-stats" aria-label="Training at a glance">
        {tiles.map(({ view, label, hint, value, icon: Icon, href }) => (
          <li key={label} className="flex">
            <Link href={href} className="pc-stat w-full" aria-current={view && view === data.view ? "page" : undefined}>
              <span className="pc-tile-icon"><Icon aria-hidden="true" /></span>
              <span><span className="pc-stat-figure block">{value}</span><span className="block font-semibold">{label}</span></span>
              <span className="text-xs text-ui-muted-foreground">{hint}</span>
            </Link>
          </li>
        ))}
      </ul>

      <section className="pc-panel" aria-label="Training records">
        <form method="get" className="flex flex-wrap items-end gap-4" role="search" aria-label="Filter training">
          <SearchField label="Person" placeholder="Name" name="q" defaultValue={input.q ?? ""} className="grow basis-64" />
          <div className="min-w-0 grow basis-40 space-y-2 sm:grow-0"><Label htmlFor="training-view" className="block">Show</Label>
            <NativeSelect id="training-view" name="view" defaultValue={data.view} className="min-h-11 w-full">
              {Object.entries(OVERVIEW_VIEWS).map(([value, label]) => <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>)}
            </NativeSelect>
          </div>
          <div className="min-w-0 grow basis-40 space-y-2 sm:grow-0"><Label htmlFor="training-course" className="block">Course</Label>
            <NativeSelect id="training-course" name="course" defaultValue={input.course ?? ""} className="min-h-11 w-full">
              <NativeSelectOption value="">All courses</NativeSelectOption>
              {data.courses.map((c) => <NativeSelectOption key={c.id} value={c.id}>{c.title}</NativeSelectOption>)}
            </NativeSelect>
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="min-h-11">Apply filters</Button>
            <Button asChild variant="ghost" className="min-h-11"><Link href="/training">Reset</Link></Button>
          </div>
        </form>

        {data.total > 0 ? (
          <p className="text-xs text-ui-muted-foreground">{plural(data.total, "record")}{data.total > data.rows.length ? `, showing the first ${data.rows.length}` : ""}</p>
        ) : null}
        {data.rows.length === 0 ? (
          <EmptyState as="h2" role="status" icon="graduation" title={empty.title} hint={empty.hint} />
        ) : (
          <ul className="pc-rows">
            {data.rows.map((row) => (
              <li key={row.id}>
                <Link href={`/training/people/${row.user.id}`} className="pc-row">
                  <Avatar size="lg" aria-hidden="true"><AvatarFallback>{nameInitials(row.user.name)}</AvatarFallback></Avatar>
                  <span className="pc-row-body">
                    <span className="pc-row-title">{row.user.name}</span>
                    <span className="pc-row-hint">
                      {[
                        row.course.title,
                        row.user.jobTitle,
                        ...(row.state === "completed" && row.completedAt
                          ? [`Completed ${formatDate(row.completedAt)}`, row.signedOffByName ? `signed off by ${row.signedOffByName}` : null]
                          : [`Assigned ${formatDate(row.assignedAt)}`, row.dueOn ? `due ${formatDate(row.dueOn)}` : "no deadline"]),
                      ].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="pc-row-trail">
                    <Tag meta={TRAINING_STATUS_META[row.state]} />
                    <ChevronRight aria-hidden="true" className="pc-row-chevron" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

/** What each view says when it holds nothing. */
const EMPTY: Record<keyof typeof OVERVIEW_VIEWS, { title: string; hint: string }> = {
  open: { title: "No open training", hint: "Nobody you cover has training to do. Assigned courses appear here." },
  overdue: { title: "Nothing overdue", hint: "Everyone you cover is on time." },
  submitted: { title: "Nobody is waiting for sign-off", hint: "Practical training appears here when someone asks for sign-off." },
  completed: { title: "No completed training in the last 30 days", hint: "Finished and signed-off courses appear here for 30 days." },
  all: { title: "No training yet", hint: "Assigned courses appear here." },
};
