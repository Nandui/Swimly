import type { ReactNode } from "react";
import Form from "next/form";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Search, SearchX, UsersRound, X } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/shadcn/empty";
import type { StudentRow } from "@/lib/students/data/students";
import { swimmerDirectoryHref, type SwimmerStatusFilter } from "@/lib/students/directory";
import { StudentDirectory } from "./student-directory";
import { cn } from "@/lib/utils";

const LENSES = [{ key: "ALL", label: "All swimmers" }, { key: "ACTIVE", label: "Active" }, { key: "INACTIVE", label: "Inactive" }] as const;
const number = (value: number) => value.toLocaleString("en-IE");

export function SwimmerBrowser({ students, total, page, pageSize, counts, q, status, addAction }: {
  students: StudentRow[];
  total: number;
  page: number;
  pageSize: number;
  counts: { all: number; active: number; inactive: number };
  q: string;
  status: SwimmerStatusFilter;
  addAction?: ReactNode;
}) {
  const filtered = Boolean(q) || status !== "ALL";
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const returnTo = swimmerDirectoryHref({ q, status, page });
  const countFor = (key: SwimmerStatusFilter) => key === "ALL" ? counts.all : key === "ACTIVE" ? counts.active : counts.inactive;
  return (
    <section className="min-w-0 space-y-6 text-ui-foreground" aria-labelledby="swimmers-heading" data-swimmer-browser>
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h1 id="swimmers-heading" className="text-2xl font-semibold tracking-tight">Swimmers</h1>
          {addAction}
        </div>
        <p className="text-sm text-ui-muted-foreground">Search across all sites, then open a swimmer’s profile.</p>
      </header>

      <div className="space-y-4">
        <Form action="/students" className="flex items-end gap-2" role="search" aria-label="Swimmer directory">
          {status !== "ALL" ? <input type="hidden" name="status" value={status} /> : null}
          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor="swimmer-query">Find a swimmer</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ui-muted-foreground" aria-hidden="true" />
              <Input key={q} id="swimmer-query" type="search" name="q" defaultValue={q} placeholder="Name, member number or contact…" className="h-11 pl-10" autoComplete="off" />
            </div>
          </div>
          <Button type="submit" className="h-11">Search</Button>
        </Form>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Filter swimmers by status" className="inline-flex max-w-full items-center gap-1 rounded-ui-lg bg-ui-muted p-1">
            {LENSES.map((lens) => (
              <Button key={lens.key} asChild variant="ghost" size="sm" className={cn("gap-1.5 px-2 text-xs sm:px-3 sm:text-sm", status === lens.key && "bg-ui-background text-ui-foreground shadow-sm hover:bg-ui-background")}>
                <Link href={swimmerDirectoryHref({ q, status: lens.key })} aria-current={status === lens.key ? "page" : undefined}>
                  {lens.label}<span className="text-xs text-ui-muted-foreground tabular-nums">{number(countFor(lens.key))}</span>
                </Link>
              </Button>
            ))}
          </nav>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex min-h-8 flex-wrap items-center justify-between gap-2 text-sm text-ui-muted-foreground" aria-live="polite" aria-atomic="true">
          <p>{total ? <><span className="font-medium text-ui-foreground">{number((page - 1) * pageSize + 1)}–{number(Math.min(page * pageSize, total))}</span> of {number(total)} {filtered ? "matches" : "swimmers"}</> : "0 swimmers"}</p>
          {filtered ? <Button asChild variant="ghost" size="sm"><Link href="/students"><X aria-hidden="true" />Clear filters</Link></Button> : <span className="text-xs">Surname A–Z</span>}
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
