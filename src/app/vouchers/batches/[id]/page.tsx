import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Printer } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Figure, Figures } from "@/components/ui-kit/figure";
import { Notice } from "@/components/ui-kit/notice";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { RecordFact, RecordFacts, RecordSection } from "@/components/ui-kit/record";
import { formatDate, formatDateTime, plural } from "@/lib/format";
import { batchPage, BatchStateTag, CancelBatch, VoucherStateTag } from "@/modules/vouchers/features/batches";

export const metadata: Metadata = { title: "Voucher batch" };

/** One batch: who it went to, how many were used, and every voucher in it. A voucher's code
 *  opens it on Redeem, where it is used, put right or cancelled. */
export default async function BatchPage({ params }: PageProps<"/vouchers/batches/[id]">) {
  const { batch: b, counts, canChange } = await batchPage((await params).id);
  const live = b.state !== "void";
  return (
    <PageShell spacing="roomy" header={<PageHeader title={b.recipient} back={{ href: "/vouchers/batches", label: "Issued vouchers" }}
        status={<BatchStateTag state={b.state} />}
        description={`${plural(b.quantity, `${b.service} voucher`)} · ${b.occasion} · ${formatDate(b.validFrom)} to ${formatDate(b.validUntil)}`}
        actions={live ? <>
          {canChange && counts.open ? <CancelBatch id={b.id} recipient={b.recipient} unused={counts.open} /> : null}
          {canChange ? <Button asChild variant="outline"><Link href={`/vouchers/batches/${b.id}/edit`}><Pencil aria-hidden="true" />Change</Link></Button> : null}
          {counts.open ? <Button asChild><Link href={`/vouchers/batches/${b.id}/print`}><Printer aria-hidden="true" />Print vouchers</Link></Button> : null}
        </> : undefined} />}>
      {b.voidedAt ? <Notice tone="error" title={`Cancelled by ${b.voidedByName ?? "a colleague"} on ${formatDate(b.voidedAt)}`} description={b.voidReason || undefined} /> : null}
      {live && !canChange ? <Notice title="You can see this batch, not change it" description="It includes a site your level does not cover." /> : null}

      <Figures label="This batch's vouchers">
        <Figure label="Used" value={counts.used} />
        <Figure label="Still to use" value={counts.open} />
        <Figure label="Expired unused" value={counts.expired} />
        <Figure label="Cancelled" value={counts.void} />
      </Figures>

      <RecordSection id="batch-details" title="Details">
        <div className="pc-panel">
          <RecordFacts>
            <RecordFact label="Contact">{[b.contactName, b.contactDetail].filter(Boolean).join(" · ") || "None recorded"}</RecordFact>
            <RecordFact label="Accepted at">{b.siteNames.join(", ")}</RecordFact>
            <RecordFact label="Made by">{b.createdByName}, {formatDate(b.createdAt)}</RecordFact>
            <RecordFact label="Small print" wide>{b.terms || "None"}</RecordFact>
            {b.note ? <RecordFact label="Note for staff" wide>{b.note}</RecordFact> : null}
          </RecordFacts>
        </div>
      </RecordSection>

      <RecordSection id="batch-vouchers" title="Vouchers" aside={<p>{b.vouchers.length}</p>} note="Choose a code to open that voucher on Redeem.">
        <ul className="pc-list">
          {b.vouchers.map((v) => (
            <li key={v.id}>
              <Link href={`/vouchers?${new URLSearchParams({ code: v.code })}`} className="pc-row">
                <span className="pc-row-body">
                  <span className="pc-row-title tracking-wider tabular-nums">{v.code}</span>
                  <span className="pc-row-hint">{[`${v.number} of ${b.quantity}`, v.redeemedAt ? `used ${formatDateTime(v.redeemedAt)}` : null, v.redeemedSiteName, v.redeemedByName ? `by ${v.redeemedByName}` : null].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="pc-row-trail"><VoucherStateTag state={v.state} /></span>
              </Link>
            </li>
          ))}
        </ul>
      </RecordSection>
    </PageShell>
  );
}
