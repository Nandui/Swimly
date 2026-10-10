import type { Metadata } from "next";
import UiLink from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { SegmentedLinks } from "@/components/ui-kit/segmented-links";
import { Tag } from "@/components/ui-kit/tag";
import { ApplyParentChange, DeclineParentChange, listParentChangeRequests, PARENT_CHANGE_STATUS_META } from "@/modules/activities/features/students";
import { formatDateTime } from "@/lib/format";
import { screenPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Parent updates" };

/** Parents' proposed corrections to contact, emergency and medical details.
 *  Nothing changes on a swimmer until someone here applies it. */
export default async function ParentChangesPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await screenPage("students", "students.manage");
  const done = (await searchParams).view === "done";
  const rows = await listParentChangeRequests(done ? "DONE" : "PENDING");
  return (
    <div className="tf-content min-w-0">
      <PageHeader back={{ href: "/students", label: "Swimmers" }} title="Parent updates" description="Check each correction parents send from the parent app, then apply it or decline it with a reply" />
      <SegmentedLinks label="Request status" items={[
        { href: "/students/parent-changes", label: "Waiting", current: !done },
        { href: "/students/parent-changes?view=done", label: "Decided", current: done },
      ]} />
      {rows.length === 0 ? (
        <EmptyState icon="users" title={done ? "Nothing decided yet" : "No updates waiting"} hint={done ? "Decided requests stay here for reference" : "Parents send corrections from the parent app. The swimmer's record only changes when you apply one."} />
      ) : rows.map((row) => {
        const status = PARENT_CHANGE_STATUS_META[row.status as keyof typeof PARENT_CHANGE_STATUS_META];
        return (
          <section key={row.id} className="pc-panel" aria-labelledby={`change-${row.id}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 id={`change-${row.id}`}><UiLink className="inline-flex min-h-11 items-center underline-offset-4 hover:underline" href={`/students/${row.student.id}`}>{row.student.name}</UiLink></h2>
                <p className="pc-row-hint break-words">From {row.parent.name ?? "a verified parent"} ({row.parent.email}) · {formatDateTime(row.createdAt)}</p>
              </div>
              {status ? <Tag meta={status} /> : null}
            </div>
            {row.message ? <div className="pc-note text-sm"><p className="min-w-0 whitespace-pre-wrap break-words"><span className="font-semibold">Parent&apos;s note: </span>{row.message}</p></div> : null}
            <Table containerClassName="pc-only-wide">
              <TableHeader><TableRow><TableHead scope="col">Detail</TableHead><TableHead scope="col">On record now</TableHead><TableHead scope="col">Proposed</TableHead></TableRow></TableHeader>
              <TableBody>
                {row.changes.map((change) => (
                  <TableRow key={change.field}>
                    <TableCell>{change.label}</TableCell>
                    <TableCell className="whitespace-pre-wrap text-ui-muted-foreground">{change.current || "Not recorded"}</TableCell>
                    <TableCell className="whitespace-pre-wrap font-semibold">{change.proposed || "Remove"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ul className="pc-rows pc-only-narrow" aria-label="Proposed changes">
              {row.changes.map((change) => (
                <li key={change.field} className="pc-row">
                  <div className="pc-row-body">
                    <p className="pc-row-title">{change.label}</p>
                    <p className="pc-row-hint whitespace-pre-wrap break-words">On record: {change.current || "Not recorded"}</p>
                    <p className="pc-row-hint whitespace-pre-wrap break-words">Proposed: <span className="font-semibold text-ui-foreground">{change.proposed || "Remove"}</span></p>
                  </div>
                </li>
              ))}
            </ul>
            {row.status === "PENDING" ? (
              <div className="flex flex-wrap justify-end gap-2">
                <DeclineParentChange id={row.id} name={row.student.name} />
                <ApplyParentChange id={row.id} name={row.student.name} />
              </div>
            ) : (
              <p className="pc-row-hint">{row.reviewedByName ?? "Reception"} · {row.reviewedAt ? formatDateTime(row.reviewedAt) : ""}{row.reply ? ` · Reply: ${row.reply}` : ""}</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
