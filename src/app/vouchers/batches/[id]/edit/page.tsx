import type { Metadata } from "next";
import { PageHeader } from "@/components/ui-kit/page-header";
import { BatchForm } from "@/components/vouchers/batch-form";
import { batchForm } from "@/lib/vouchers/data";

export const metadata: Metadata = { title: "Change a batch" };

/** Change a batch's details, dates or sites. Vouchers already printed keep
 *  working: the codes do not change. */
export default async function EditBatchPage({ params }: { params: Promise<{ id: string }> }) {
  const data = await batchForm((await params).id);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Change this batch" back={data.existing ? { href: `/vouchers/batches/${data.existing.id}`, label: "The batch" } : undefined}
        description="The codes stay the same, so vouchers already handed out keep working. Print them again if what is printed on them changes." />
      <BatchForm sites={data.sites} today={data.today} suggestions={data.suggestions} existing={data.existing} />
    </div>
  );
}
