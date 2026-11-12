import type { Metadata } from "next";
import { PageHeader } from "@/components/ui-kit/page-header";
import { BatchForm } from "@/components/vouchers/batch-form";
import { batchForm } from "@/lib/vouchers/data";

export const metadata: Metadata = { title: "Give vouchers" };

/** Make a batch of vouchers for one community or organisation. */
export default async function NewBatchPage() {
  const data = await batchForm();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Give vouchers" back={{ href: "/vouchers/batches", label: "Issued vouchers" }}
        description="One batch for one community or organisation. Every voucher gets its own code; print them when the batch is made." />
      <BatchForm sites={data.sites} today={data.today} suggestions={data.suggestions} existing={null} />
    </div>
  );
}
