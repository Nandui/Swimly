import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Printer } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { Notice } from "@/components/ui-kit/notice";
import { PageHeader } from "@/components/ui-kit/page-header";
import { CancelBatch } from "@/components/vouchers/batch-actions";
import { BatchStateTag, VoucherStateTag } from "@/components/vouchers/status";
import { formatDate, formatDateTime, plural } from "@/lib/format";
import { batchPage } from "@/lib/vouchers/data";

export const metadata: Metadata = { title: "Voucher batch" };

/** One batch: who it went to, how many were used, and every voucher in it.
 *  A voucher's code opens it on Redeem, where it is used, put right or cancelled. */
export default async function BatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { batch: b, counts, canChange } = await batchPage((await params).id);
  const live = b.state !== "void";
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={b.recipient} back={{ href: "/vouchers/batches", label: "Issued vouchers" }}
        status={<BatchStateTag state={b.state} />}
        description={`${plural(b.quantity, `${b.service} voucher`)} · ${b.occasion} · ${formatDate(b.validFrom)} to ${formatDate(b.validUntil)}`}
        actions={live ? <>
          {canChange && counts.open ? <CancelBatch id={b.id} recipient={b.recipient} unused={counts.open} /> : null}
          {canChange ? <Button asChild variant="outline"><Link href={`/vouchers/batches/${b.id}/edit`}><Pencil aria-hidden="true" />Change</Link></Button> : null}
          {counts.open ? <Button asChild><Link href={`/vouchers/batches/${b.id}/print`}><Printer aria-hidden="true" />Print vouchers</Link></Button> : null}
        </> : undefined} />

      {b.voidedAt ? <Notice tone="error" title={`Cancelled by ${b.voidedByName ?? "a colleague"} on ${formatDate(b.voidedAt)}`} description={b.voidReason || undefined} /> : null}
      {live && !canChange ? <Notice title="You can see this batch, not change it" description="It includes a site your role does not cover." /> : null}

      <ul className="pc-stats" aria-label="This batch's vouchers">
        {([["Used", counts.used], ["Still to use", counts.open], ["Expired unused", counts.expired], ["Cancelled", counts.void]] as const).map(([label, n]) => (
          <li key={label} className="pc-stat"><span className={`pc-stat-figure${n ? "" : " text-ui-muted-foreground"}`}>{n}</span><span className="font-semibold">{label}</span></li>
        ))}
      </ul>

      <section aria-labelledby="batch-details" className="pc-panel">
        <div className="pc-panel-head"><h2 id="batch-details">Details</h2></div>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Detail term="Contact">{[b.contactName, b.contactDetail].filter(Boolean).join(" · ") || "None recorded"}</Detail>
          <Detail term="Accepted at">{b.siteNames.join(", ")}</Detail>
          <Detail term="Made by">{b.createdByName}, {formatDate(b.createdAt)}</Detail>
          <Detail term="Small print">{b.terms || "None"}</Detail>
          {b.note ? <Detail term="Note for staff"><span className="whitespace-pre-line">{b.note}</span></Detail> : null}
        </dl>
      </section>

      <section aria-labelledby="batch-vouchers" className="pc-panel">
        <div className="pc-panel-head"><h2 id="batch-vouchers">Vouchers · {b.vouchers.length}</h2></div>
        <Table containerClassName="rounded-[var(--pc-radius-card)] border border-ui-border">
          <TableHeader>
            <TableRow>
              <TableHead className="w-14 px-3 text-right">No.</TableHead>
              <TableHead className="px-3">Code</TableHead>
              <TableHead className="px-3">Status</TableHead>
              <TableHead className="px-3">Used</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {b.vouchers.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="px-3 text-right text-ui-muted-foreground tabular-nums">{v.number}</TableCell>
                <TableCell className="px-3"><Link href={`/vouchers?${new URLSearchParams({ code: v.code })}`} className="inline-flex min-h-11 items-center font-semibold tracking-wider tabular-nums underline-offset-4 hover:underline">{v.code}</Link></TableCell>
                <TableCell className="px-3"><VoucherStateTag state={v.state} /></TableCell>
                <TableCell className="px-3 whitespace-normal text-ui-muted-foreground">{v.redeemedAt ? [formatDateTime(v.redeemedAt), v.redeemedSiteName, v.redeemedByName ? `by ${v.redeemedByName}` : null].filter(Boolean).join(" · ") : "–"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}

function Detail({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold tracking-wide text-ui-muted-foreground uppercase">{term}</dt>
      <dd className="break-words">{children}</dd>
    </div>
  );
}
