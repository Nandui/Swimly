import type { Metadata } from "next";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { BatchForm, batchForm } from "@/modules/vouchers/features/batches";

export const metadata: Metadata = { title: "Give vouchers" };

/** Make a batch of vouchers for one community or organisation. */
export default async function NewBatchPage() {
  const data = await batchForm();
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Give vouchers" back={{ href: "/vouchers/batches", label: "Issued vouchers" }}
        description="One batch for one community or organisation. Every voucher gets its own code; print them when the batch is made." />}>
      <BatchForm sites={data.sites} today={data.today} suggestions={data.suggestions} existing={null} />
    </PageShell>
  );
}
