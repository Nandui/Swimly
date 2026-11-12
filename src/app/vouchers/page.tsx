import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Notice } from "@/components/ui-kit/notice";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { RecordFacts, RecordSection } from "@/components/ui-kit/record";
import { formatDate, formatDateTime } from "@/lib/format";
import { CodeLookup, RedeemVoucher, redeemPage, UndoRedeem, VoidVoucher, VoucherStateTag } from "@/modules/vouchers/features/redeem";

export const metadata: Metadata = { title: "Redeem a voucher" };

/** The desk's page: type the code on a voucher, see what it is for and whether it can be used,
 *  and mark it as used. Underneath, the latest used here. */
export default async function RedeemPage({ searchParams }: PageProps<"/vouchers">) {
  const code = (await searchParams).code;
  const { typed, found: v, latest, hasSites } = await redeemPage(typeof code === "string" ? code : undefined);
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Redeem a voucher" description="Check the code printed on a voucher, then mark it as used. Each code works once." />}>
      <section aria-label="Check a voucher" className="pc-panel">
        <CodeLookup key={typed} typed={typed} />
      </section>

      {typed && !v ? (
        <Notice tone="warning" live="status" title={`No voucher has the code ${typed.toUpperCase()}`}
          description="Check each character against the voucher. Codes are eight characters and never use 0, 1, I, L or O." />
      ) : null}

      {v ? (
        <RecordSection id="voucher-result" title={<span className="tracking-widest tabular-nums">{v.code}</span>} aside={<VoucherStateTag state={v.state} />}>
          <div className="pc-panel">
            <RecordFacts items={[
              ["Gives", v.batch.service],
              ["Given to", `${v.batch.recipient} · ${v.batch.occasion}`],
              ["Can be used", `${formatDate(v.batch.validFrom)} to ${formatDate(v.batch.validUntil)}`],
              ["Accepted at", v.acceptedNames.join(", ") || "No site"],
            ]} />

            {v.state === "used" ? (
              v.justNow
                ? <Notice tone="success" live="status" title="Marked as used" description={`${v.batch.service}, at ${v.redeemedSiteName ?? "your site"}. Type the next code above when you are ready.`} />
                : <Notice tone="error" live="status" title="Already used" description={`${v.redeemedAt ? `On ${formatDateTime(v.redeemedAt)}` : "Earlier"}${v.redeemedSiteName ? ` at ${v.redeemedSiteName}` : ""}${v.redeemedByName ? `, marked by ${v.redeemedByName}` : ""}. It cannot be used again.`} />
            ) : null}
            {v.state === "void" ? <Notice tone="error" live="status" title="Cancelled" description={v.batch.voidedAt ? `These vouchers were cancelled${v.batch.voidReason ? `: ${v.batch.voidReason}` : "."}` : `This voucher was cancelled${v.voidedByName ? ` by ${v.voidedByName}` : ""}. It cannot be used.`} /> : null}
            {v.state === "upcoming" ? <Notice tone="warning" live="status" title="Not valid yet" description={`It can be used from ${formatDate(v.batch.validFrom)}.`} /> : null}
            {v.state === "expired" ? <Notice tone="warning" live="status" title="Expired" description={`Its last day was ${formatDate(v.batch.validUntil)}.`} /> : null}
            {v.state === "valid" && v.redeemAt.length === 0 ? (
              <Notice tone="warning" live="status" title={hasSites ? "Not accepted at your site" : "Your level does not cover a site to use vouchers at"} description={hasSites ? `It can be used at ${v.acceptedNames.join(" or ")}.` : undefined} />
            ) : null}

            {v.redeemAt.length || v.canUndo || v.canVoid || v.canOpenBatch ? (
              <div className="flex flex-wrap items-end justify-between gap-3">
                {v.redeemAt.length ? <RedeemVoucher code={v.code} sites={v.redeemAt} /> : <span />}
                <div className="flex flex-wrap items-center gap-2">
                  {v.canUndo ? <UndoRedeem id={v.id} code={v.code} /> : null}
                  {v.canVoid ? <VoidVoucher id={v.id} code={v.code} /> : null}
                  {v.canOpenBatch ? <Button asChild variant="ghost" className="min-h-11"><Link href={`/vouchers/batches/${v.batch.id}`}>Open the batch</Link></Button> : null}
                </div>
              </div>
            ) : null}
          </div>
        </RecordSection>
      ) : null}

      <RecordSection id="vouchers-latest" title="Latest used at your sites">
        {latest.length === 0 ? (
          <div className="pc-list"><EmptyState compact icon="receipt" title="No vouchers used yet" hint="Each voucher you mark as used shows here." /></div>
        ) : (
          <ul className="pc-list">
            {latest.map((u) => (
              <li key={u.id} className="pc-row">
                <span className="pc-row-body">
                  <span className="pc-row-title">{u.batch.service} · {u.batch.recipient}</span>
                  <span className="pc-row-hint">{[u.redeemedAt ? formatDateTime(u.redeemedAt) : null, u.siteName, u.redeemedByName ? `by ${u.redeemedByName}` : null].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="pc-row-trail tracking-wider tabular-nums">{u.code}</span>
              </li>
            ))}
          </ul>
        )}
      </RecordSection>
    </PageShell>
  );
}
