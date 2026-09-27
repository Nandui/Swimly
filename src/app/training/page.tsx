import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, CheckCheck, ClipboardCheck, Hourglass, Search, TriangleAlert } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Item, ItemContent, ItemGroup, ItemTitle } from "@/components/shadcn/item";
import { Label } from "@/components/shadcn/label";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { AssignTraining } from "@/components/training/manage-actions";
import { TrainingStatusTag } from "@/components/training/status";
import { formatDate } from "@/lib/format";
import { assignablePeople, trainingOverview, OVERVIEW_VIEWS } from "@/lib/training/data";

export const metadata: Metadata = { title: { absolute: "Turnfin Training" } };

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
    <div className="min-w-0 flex flex-col gap-6">
      <PageHeader
        title="Training"
        description="Training for the people you cover: what is due, waiting for sign-off and done."
        actions={data.who.assign && activeCourses.length > 0 && people.length > 0 ? <AssignTraining courses={activeCourses} people={people} /> : null}
      />

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(({ label, value, icon: Icon, href }) => (
          <div key={label} className="min-w-0">
            <Link href={href} className="flex h-full flex-col gap-2 rounded-ui-lg border border-ui-border p-4 hover:bg-ui-muted/50">
              <dt className="flex items-center gap-2 text-sm text-ui-muted-foreground"><Icon aria-hidden="true" className="size-4 shrink-0" />{label}</dt>
              <dd className="mt-auto text-2xl font-semibold tabular-nums">{value}</dd>
            </Link>
          </div>
        ))}
      </dl>

      <form method="get" className="flex flex-col gap-4 rounded-ui-lg border border-ui-border p-4" role="search" aria-label="Filter training">
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

      <section className="min-w-0 flex flex-col gap-3" aria-label="Training records">
        <p className="text-sm text-ui-muted-foreground">{data.total} {data.total === 1 ? "record" : "records"}{data.total > data.rows.length ? `, showing the first ${data.rows.length}` : ""}</p>
        {data.rows.length === 0 ? (
          <EmptyState icon="graduationCap" title="Nothing to show" hint={`Try another filter${data.who.assign ? ", or assign a course" : ""}.`} />
        ) : (
          <ItemGroup className="divide-y divide-ui-border rounded-ui-lg border border-ui-border">
            {data.rows.map((row) => (
              <Item key={row.id} asChild role="listitem" className="rounded-none">
                <Link href={`/training/people/${row.user.id}`} prefetch={false} className="hover:bg-ui-muted/50">
                  <ItemContent className="min-w-0 gap-1">
                    <div className="flex flex-wrap items-center gap-2"><ItemTitle>{row.user.name}</ItemTitle><TrainingStatusTag state={row.state} /></div>
                    <p className="text-sm">{row.course.title}{row.user.jobTitle ? <span className="text-ui-muted-foreground"> · {row.user.jobTitle}</span> : null}</p>
                    <p className="text-xs text-ui-muted-foreground">
                      {row.state === "completed" && row.completedAt
                        ? `Completed ${formatDate(row.completedAt)}${row.signedOffByName ? ` · signed off by ${row.signedOffByName}` : ""}`
                        : `Assigned ${formatDate(row.assignedAt)} · ${row.dueOn ? `due ${formatDate(row.dueOn)}` : "no deadline"}`}
                    </p>
                  </ItemContent>
                  <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-ui-muted-foreground" />
                </Link>
              </Item>
            ))}
          </ItemGroup>
        )}
      </section>
    </div>
  );
}
