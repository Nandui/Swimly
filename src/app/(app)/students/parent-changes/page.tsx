import type { Metadata } from "next";
import UiLink from "next/link";
import { Card } from "@/components/shadcn/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { BackLink } from "@/components/ui-kit/back-link";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Lead } from "@/components/ui-kit/prose";
import { Tag } from "@/components/ui-kit/tag";
import { ApplyParentChange, DeclineParentChange } from "@/components/students/parent-change-actions";
import { formatDateTime } from "@/lib/format";
import { screenPage } from "@/lib/page-guards";
import { listParentChangeRequests } from "@/lib/students/data/parent-changes";
import { PARENT_CHANGE_STATUS_META } from "@/lib/students/constants";

export const metadata: Metadata = { title: "Parent updates" };

/** Parents' proposed corrections to contact, emergency and medical details.
 *  Nothing changes on a swimmer until someone here applies it. */
export default async function ParentChangesPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await screenPage("students", "students.manage");
  const done = (await searchParams).view === "done";
  const rows = await listParentChangeRequests(done ? "DONE" : "PENDING");
  return (
    <div className="min-w-0 flex flex-col gap-6">
      <BackLink href="/students" current="Parent updates">Swimmers</BackLink>
      <PageHeader title="Parent updates" description="Contact, emergency and medical corrections sent by parents from the parent app." />
      <Lead>
        {done ? "Recently decided requests." : "Check each change, then apply it or decline it with a reply. The swimmer's record only changes when you apply."}{" "}
        <UiLink className="underline underline-offset-4" href={done ? "/students/parent-changes" : "/students/parent-changes?view=done"}>{done ? "Show waiting requests" : "Show decided requests"}</UiLink>
      </Lead>
      {rows.length === 0 ? (
        <EmptyState icon="users" title={done ? "Nothing decided yet" : "No updates waiting"} hint="Parents send corrections from the parent app. They appear here for review." />
      ) : rows.map((row) => {
        const status = PARENT_CHANGE_STATUS_META[row.status as keyof typeof PARENT_CHANGE_STATUS_META];
        return (
          <Card key={row.id} className="gap-4 p-5 shadow-none">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold"><UiLink className="underline-offset-4 hover:underline" href={`/students/${row.student.id}`}>{row.student.name}</UiLink></h2>
                <p className="text-sm text-ui-muted-foreground">From {row.parent.name ?? "a verified parent"} ({row.parent.email}) · {formatDateTime(row.createdAt)}</p>
              </div>
              {status ? <Tag color={status.color}>{status.label}</Tag> : null}
            </div>
            {row.message ? <p className="text-sm whitespace-pre-wrap"><span className="font-semibold">Parent&apos;s note: </span>{row.message}</p> : null}
            <Table>
              <TableHeader><TableRow><TableHead scope="col">Detail</TableHead><TableHead scope="col">On record now</TableHead><TableHead scope="col">Parent proposes</TableHead></TableRow></TableHeader>
              <TableBody>
                {row.changes.map((change) => (
                  <TableRow key={change.field}>
                    <TableCell className="font-medium">{change.label}</TableCell>
                    <TableCell className="whitespace-pre-wrap text-ui-muted-foreground">{change.current || "Not recorded"}</TableCell>
                    <TableCell className="whitespace-pre-wrap">{change.proposed || "Remove"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {row.status === "PENDING" ? (
              <div className="flex flex-wrap gap-2">
                <ApplyParentChange id={row.id} name={row.student.name} />
                <DeclineParentChange id={row.id} name={row.student.name} />
              </div>
            ) : (
              <p className="text-sm text-ui-muted-foreground">{row.reviewedByName ?? "Reception"} · {row.reviewedAt ? formatDateTime(row.reviewedAt) : ""}{row.reply ? ` · Reply: ${row.reply}` : ""}</p>
            )}
          </Card>
        );
      })}
    </div>
  );
}
