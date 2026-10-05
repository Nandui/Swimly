import type { Metadata } from "next";
import UiLink from "next/link";
import { Card } from "@/components/shadcn/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { BackLink } from "@/components/ui-kit/back-link";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Lead } from "@/components/ui-kit/prose";
import { Tag } from "@/components/ui-kit/tag";
import { ApplyDetailChange, DeclineDetailChange } from "@/components/people/details-request-actions";
import { formatDateTime } from "@/lib/format";
import { screenPage } from "@/lib/page-guards";
import { DETAIL_REQUEST_STATUS_META, listDetailRequests } from "@/lib/people/details-requests";

export const metadata: Metadata = { title: "Details changes" };

/** Staff's own contact and emergency details, as they asked to change them in
 *  Turnfin Me. Nothing changes on a record until someone here applies it. */
export default async function DetailRequestsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await screenPage("staff", "staff.manage");
  const done = (await searchParams).view === "done";
  const rows = await listDetailRequests(done ? "DONE" : "PENDING");
  return (
    <div className="min-w-0 flex flex-col gap-6">
      <BackLink href="/staff" current="Details changes">Staff</BackLink>
      <PageHeader title="Details changes" description="Phone, address and emergency contacts that staff asked to update in Turnfin Me." />
      <Lead>
        {done ? "Recently decided requests." : "Check each change, then apply it or decline it with a reply. The record only changes when you apply."}{" "}
        <UiLink className="underline underline-offset-4" href={done ? "/staff/details-requests" : "/staff/details-requests?view=done"}>{done ? "Show waiting requests" : "Show decided requests"}</UiLink>
      </Lead>
      {rows.length === 0 ? (
        <EmptyState icon="users" title={done ? "Nothing decided yet" : "No changes waiting"} hint="Staff update their own details in Turnfin Me. Their requests appear here." />
      ) : rows.map((row) => {
        const status = DETAIL_REQUEST_STATUS_META[row.status];
        return (
          <Card key={row.id} className="gap-4 p-5 shadow-none">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold"><UiLink className="underline-offset-4 hover:underline" href={`/staff/${row.person.id}`}>{row.person.name}</UiLink></h2>
                <p className="text-sm text-ui-muted-foreground">{row.person.jobTitle ? `${row.person.jobTitle} · ` : ""}{formatDateTime(row.createdAt)}</p>
              </div>
              <Tag meta={status} />
            </div>
            {row.message ? <p className="whitespace-pre-wrap text-sm"><span className="font-semibold">Their note: </span>{row.message}</p> : null}
            <Table>
              <TableHeader><TableRow><TableHead scope="col">Detail</TableHead><TableHead scope="col">On record now</TableHead><TableHead scope="col">They ask for</TableHead></TableRow></TableHeader>
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
                <ApplyDetailChange id={row.id} name={row.person.name} />
                <DeclineDetailChange id={row.id} name={row.person.name} />
              </div>
            ) : (
              <p className="text-sm text-ui-muted-foreground">{row.reviewedByName ?? "Staff"} · {row.reviewedAt ? formatDateTime(row.reviewedAt) : ""}{row.reply ? ` · Reply: ${row.reply}` : ""}</p>
            )}
          </Card>
        );
      })}
    </div>
  );
}
