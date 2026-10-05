import type { ReactNode } from "react";
import Form from "next/form";
import Link from "next/link";
import { SegmentedLinks } from "@/components/ui-kit/segmented-links";
import { ArrowLeft, ArrowRight, SearchX, UsersRound, X } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { SearchField } from "@/components/ui-kit/search-field";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/shadcn/empty";
import type { StudentRow } from "@/modules/activities/lib/students/data/students";
import { swimmerDirectoryHref, type SwimmerStatusFilter } from "@/modules/activities/lib/students/directory";
import { StudentDirectory } from "./student-directory";

const LENSES = [{ key: "ALL", label: "All swimmers" }, { key: "ACTIVE", label: "Active" }, { key: "INACTIVE", label: "Inactive" }] as const;
const number = (value: number) => value.toLocaleString("en-IE");

export function SwimmerBrowser({ students, total, page, pageSize, counts, q, status, addAction, parentAction }: {
  students: StudentRow[];
  total: number;
  page: number;
  pageSize: number;
  counts: { all: number; active: number; inactive: number };
  q: string;
  status: SwimmerStatusFilter;
  addAction?: ReactNode;
  parentAction?: ReactNode;
}) {
  const filtered = Boolean(q) || status !== "ALL";
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const returnTo = swimmerDirectoryHref({ q, status, page });
  const countFor = (key: SwimmerStatusFilter) => key === "ALL" ? counts.all : key === "ACTIVE" ? counts.active : counts.inactive;
  return (
    <section className="flex min-w-0 flex-col gap-4 text-ui-foreground" aria-labelledby="swimmers-heading" data-swimmer-browser>
      <header className="mb-2 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 id="swimmers-heading" className="text-2xl font-semibold">Swimmers</h1>
          <div className="flex flex-wrap gap-2">{parentAction}{addAction}</div>
        </div>
        <p className="text-sm text-ui-muted-foreground">Search across all sites, then open a swimmer’s profile.</p>
      </header>

      <div className="space-y-4">
        <Form action="/students" className="max-w-xl" role="search" aria-label="Swimmer directory">
          {status !== "ALL" ? <input type="hidden" name="status" value={status} /> : null}
          <SearchField id="swimmer-query" label="Find a swimmer" defaultValue={q} placeholder="Name, member number or contact" />
        </Form>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SegmentedLinks label="Filter swimmers by status" items={LENSES.map((lens) => ({ href: swimmerDirectoryHref({ q, status: lens.key }), label: lens.label, count: number(countFor(lens.key)), current: status === lens.key }))} />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex min-h-8 flex-wrap items-center justify-between gap-2 text-sm text-ui-muted-foreground" aria-live="polite" aria-atomic="true">
          <p>{total ? <><span className="font-medium text-ui-foreground">{number((page - 1) * pageSize + 1)}–{number(Math.min(page * pageSize, total))}</span> of {number(total)} {filtered ? "matches" : "swimmers"}</> : "0 swimmers"}</p>
          {filtered ? <Button asChild variant="ghost"><Link href="/students"><X aria-hidden="true" />Clear filters</Link></Button> : <span className="text-xs">Surname A–Z</span>}
        </div>
        {students.length ? <StudentDirectory students={students} returnTo={returnTo} /> : (
          <Empty className="border border-ui-border bg-ui-muted/30 py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">{filtered ? <SearchX /> : <UsersRound />}</EmptyMedia>
              <EmptyTitle>{filtered ? "No swimmers found" : "Your swimmers will appear here"}</EmptyTitle>
              <EmptyDescription>{q ? "Try a different spelling, a member number or a contact name. You can also search all statuses." : filtered ? "There are no swimmers with this status. Choose all swimmers to see the directory." : "Add your first swimmer to start building their profile."}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>{filtered ? <Button asChild variant="outline"><Link href="/students">Show all swimmers</Link></Button> : addAction}</EmptyContent>
          </Empty>
        )}
        {pages > 1 ? (
          <nav aria-label="Swimmer directory pages" className="flex items-center justify-between gap-2 pt-2">
            {page > 1 ? <Button asChild variant="outline"><Link href={swimmerDirectoryHref({ q, status, page: page - 1 })}><ArrowLeft aria-hidden="true" />Previous</Link></Button> : <Button variant="outline" disabled><ArrowLeft aria-hidden="true" />Previous</Button>}
            <span className="text-sm text-ui-muted-foreground tabular-nums">{page} / {pages}<span className="sr-only"> pages</span></span>
            {page < pages ? <Button asChild variant="outline"><Link href={swimmerDirectoryHref({ q, status, page: page + 1 })}>Next<ArrowRight aria-hidden="true" /></Link></Button> : <Button variant="outline" disabled>Next<ArrowRight aria-hidden="true" /></Button>}
          </nav>
        ) : null}
      </div>
    </section>
  );
}
