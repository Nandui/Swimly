import type { ReactNode } from "react";
import Form from "next/form";
import Link from "next/link";
import { SegmentedLinks } from "@/components/ui-kit/segmented-links";
import { LinkPagination } from "@/components/ui-kit/link-pagination";
import { Button } from "@/components/shadcn/button";
import { SearchField } from "@/components/ui-kit/search-field";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import type { StudentRow } from "@/modules/activities/features/students/server/data/students";
import { swimmerDirectoryHref, type SwimmerStatusFilter } from "@/modules/activities/features/students/server/directory";
import { formatCount, plural } from "@/lib/format";
import { StudentDirectory } from "@/modules/activities/features/students/components/student-directory";

const LENSES = [{ key: "ALL", label: "All" }, { key: "ACTIVE", label: "Active" }, { key: "INACTIVE", label: "Inactive" }] as const;

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
  const returnTo = swimmerDirectoryHref({ q, status, page });
  const countFor = (key: SwimmerStatusFilter) => key === "ALL" ? counts.all : key === "ACTIVE" ? counts.active : counts.inactive;
  const query: Record<string, string> = {};
  if (q) query.q = q;
  if (status !== "ALL") query.status = status;
  const emptyHint = q
    ? status === "ALL" ? "Try a different spelling, a member number or a contact name." : "Try a different spelling, or search every status."
    : "There are no swimmers with this status.";
  return (
    <div className="tf-content min-w-0" data-swimmer-browser>
      <PageHeader title="Swimmers" description="Every swimmer across your sites, sorted by surname" actions={<>{parentAction}{addAction}</>} />
      <section className="pc-panel" aria-label="Swimmer directory">
        <div className="flex flex-wrap items-end gap-3">
          <Form action="/students" className="min-w-0 grow basis-[min(100%,27.5rem)] max-w-[27.5rem]" role="search" aria-label="Swimmers">
            {status !== "ALL" ? <input type="hidden" name="status" value={status} /> : null}
            <SearchField id="swimmer-query" label="Find a swimmer" defaultValue={q} placeholder="Name, member number or contact" />
          </Form>
          <SegmentedLinks label="Filter swimmers by status" items={LENSES.map((lens) => ({ href: swimmerDirectoryHref({ q, status: lens.key }), label: lens.label, count: formatCount(countFor(lens.key)), current: status === lens.key }))} />
        </div>
        {students.length ? <StudentDirectory students={students} returnTo={returnTo} /> : (
          <EmptyState
            as="h2"
            role="status"
            icon={filtered ? "searchX" : "usersRound"}
            title={filtered ? "No swimmers found" : "Your swimmers will appear here"}
            hint={filtered ? emptyHint : "Add a swimmer to start their profile."}
            action={filtered ? <Button asChild variant="outline"><Link href="/students">Clear filters</Link></Button> : undefined}
          />
        )}
        {total > pageSize ? (
          <LinkPagination label="Swimmer directory pages" page={page} totalItems={total} pageSize={pageSize} pathname="/students" query={query} />
        ) : total ? (
          <p className="text-center text-xs text-ui-muted-foreground tabular-nums" aria-live="polite" aria-atomic="true">
            {plural(total, "swimmer")}
          </p>
        ) : null}
      </section>
    </div>
  );
}
