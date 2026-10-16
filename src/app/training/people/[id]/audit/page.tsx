import type { Metadata } from "next";
import { PageHeader } from "@/components/ui-kit/page-header";
import { personAuditPack, PersonAuditPackView, PrintButton } from "@/modules/training/features/insight";

export const metadata: Metadata = { title: "Training audit pack" };

/** One person's whole training record to print or save as a PDF. A 404 for anyone the reader's
 *  Training role does not cover. */
export default async function PersonAuditPackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await personAuditPack(id);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader back={{ href: `/training/people/${id}`, label: "Their training" }} title={`${data.person.name}: training audit pack`} actions={<PrintButton />} />
      <PersonAuditPackView data={data} />
    </div>
  );
}
