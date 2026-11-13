import type { Metadata } from "next";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { BatchForm, batchForm } from "@/modules/vouchers/features/batches";

export const metadata: Metadata = { title: "Change a batch" };

/** Change a batch's details, dates or sites. Vouchers already printed keep working: the codes do
 *  not change. */
export default async function EditBatchPage({ params }: PageProps<"/vouchers/batches/[id]/edit">) {
  const { id } = await params;
  const data = await batchForm(id);
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Change this batch" back={{ href: `/vouchers/batches/${id}`, label: "The batch" }}
        description="The codes stay the same, so vouchers already handed out keep working. Print them again if what is printed on them changes." />}>
      <BatchForm sites={data.sites} today={data.today} suggestions={data.suggestions} existing={data.existing} />
    </PageShell>
  );
}
