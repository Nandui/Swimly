import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { BatchStateTag } from "@/components/vouchers/status";
import { formatDate, plural } from "@/lib/format";
import { batchesPage } from "@/lib/vouchers/data";
import { usage } from "@/lib/vouchers/rules";

export const metadata: Metadata = { title: "Issued vouchers" };

/** Every batch given out, under its occasion, with how many were used. */
export default async function BatchesPage() {
  const { occasions } = await batchesPage();
  const add = <Button asChild><Link href="/vouchers/batches/new"><Plus aria-hidden="true" />Give vouchers</Link></Button>;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Issued vouchers" description="The vouchers given to communities and organisations, by occasion: who got how many, and how many were used." actions={add} />
      {occasions.length === 0 ? (
        <EmptyState as="h2" icon="receipt" title="No vouchers given out yet" hint="Give vouchers makes a batch for one organisation, with a code on every voucher, ready to print." action={add} />
      ) : occasions.map((o, i) => {
        const u = usage(o.given, o.used);
        return (
          <section key={o.occasion} aria-labelledby={`occasion-${i}`} className="pc-panel">
            <div className="pc-panel-head">
              <h2 id={`occasion-${i}`}>{o.occasion}</h2>
              <p className="pc-row-hint tabular-nums">{plural(o.given, "voucher")} given · {o.used} used ({u.percent}%)</p>
            </div>
            <ul className="pc-rows">
              {o.batches.map((b) => (
                <li key={b.id}>
                  <Link href={`/vouchers/batches/${b.id}`} className="pc-row">
                    <span className="pc-row-body">
                      <span className="pc-row-title">{b.recipient}</span>
                      <span className="pc-row-hint">{[plural(b.quantity, `${b.service} voucher`), `${formatDate(b.validFrom)} to ${formatDate(b.validUntil)}`, b.siteNames.join(", ")].filter(Boolean).join(" · ")}</span>
                    </span>
                    <span className="pc-row-trail">
                      <span className="font-semibold tabular-nums">{b.used} of {b.quantity} used</span>
                      <BatchStateTag state={b.state} />
                      <ChevronRight aria-hidden="true" className="pc-row-chevron" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
