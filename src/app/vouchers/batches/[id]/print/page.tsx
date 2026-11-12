import type { Metadata } from "next";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PrintSheet } from "@/components/vouchers/batch-actions";
import { formatDate, plural } from "@/lib/format";
import { printPage } from "@/lib/vouchers/data";

export const metadata: Metadata = { title: "Print vouchers" };

/** The sheet to print and cut: one card for each voucher still to hand out,
 *  with what it gives, its code, when and where it can be used and the small
 *  print. Printing hides the workspace around it (module-workspace.css). */
export default async function PrintVouchersPage({ params }: { params: Promise<{ id: string }> }) {
  const { batch: b, organisation, vouchers } = await printPage((await params).id);
  return (
    <div className="flex flex-col gap-6">
      <div data-print="hide">
        <PageHeader title="Print vouchers" back={{ href: `/vouchers/batches/${b.id}`, label: "The batch" }}
          description={`${plural(vouchers.length, "voucher")} for ${b.recipient} still to hand out. Used and cancelled vouchers are left off.`}
          actions={vouchers.length ? <PrintSheet /> : undefined} />
      </div>
      {vouchers.length === 0 ? (
        <EmptyState as="h2" icon="receipt" title="Nothing to print" hint="Every voucher in this batch has been used or cancelled." />
      ) : (
        <ul className="voucher-sheet" aria-label="Vouchers to print">
          {vouchers.map((v) => (
            <li key={v.id} className="voucher-card">
              <p className="voucher-card-org">{organisation || "Voucher"}</p>
              <p className="voucher-card-service">{b.service}</p>
              <p className="voucher-card-for">With our compliments to {b.recipient}</p>
              <p className="voucher-card-code">{v.code}</p>
              <p className="voucher-card-terms">
                Valid {formatDate(b.validFrom)} to {formatDate(b.validUntil)} at {b.siteNames.join(", ")}.{b.terms ? ` ${b.terms}` : ""}
              </p>
              <p className="voucher-card-number">{b.occasion} · {v.number} of {b.quantity}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
