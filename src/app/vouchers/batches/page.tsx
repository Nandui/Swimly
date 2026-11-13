import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Gift, Plus } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { RecordSection } from "@/components/ui-kit/record";
import { formatDate, plural } from "@/lib/format";
import { batchesPage, BatchStateTag, usage } from "@/modules/vouchers/features/batches";

export const metadata: Metadata = { title: "Issued vouchers" };

/** Every batch given out, under its occasion, with how many were used. */
export default async function BatchesPage() {
  const { occasions } = await batchesPage();
  const add = <Button asChild><Link href="/vouchers/batches/new"><Plus aria-hidden="true" />Give vouchers</Link></Button>;
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Issued vouchers" description="The vouchers given to communities and organisations, by occasion: who got how many, and how many were used." actions={add} />}>
      {occasions.length === 0 ? (
        <EmptyState as="h2" icon="receipt" title="No vouchers given out yet" hint="Give vouchers makes a batch for one organisation, with a code on every voucher, ready to print." />
      ) : occasions.map((o, i) => (
        <RecordSection key={o.occasion} id={`occasion-${i}`} title={o.occasion} aside={<p className="tabular-nums">{plural(o.given, "voucher")} given · {o.used} used ({usage(o.given, o.used).percent}%)</p>}>
          <ul className="pc-list">
            {o.batches.map((b) => (
              <li key={b.id}>
                <Link href={`/vouchers/batches/${b.id}`} className="pc-row">
                  <span className="pc-tile-icon" data-tone={b.state === "running" ? "green" : b.state === "upcoming" ? "orange" : undefined} aria-hidden="true"><Gift /></span>
                  <span className="pc-row-body">
                    <span className="pc-row-title">{b.recipient}</span>
                    <span className="pc-row-hint">{[plural(b.quantity, `${b.service} voucher`), `${formatDate(b.validFrom)} to ${formatDate(b.validUntil)}`, b.siteNames.join(", ")].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="pc-row-trail">
                    <span className="text-sm tabular-nums">{b.used} of {b.quantity} used</span>
                    <BatchStateTag state={b.state} />
                    <ChevronRight aria-hidden="true" className="pc-row-chevron" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </RecordSection>
      ))}
    </PageShell>
  );
}
