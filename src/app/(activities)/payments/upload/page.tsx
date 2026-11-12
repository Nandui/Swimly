import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { today } from "@/lib/format";
import { UploadForm, UploadHistory, uploadHistory } from "@/modules/activities/features/payment-upload";
import { requirePaymentsActor } from "@/modules/activities/features/failed-payments";

export const metadata: Metadata = { title: "Upload the failure sheet" };

/** Manage's page: anyone else gets "not found", as for any page their role does not open. */
export default async function PaymentsUploadPage() {
  if (!(await requirePaymentsActor()).manage) notFound();
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Upload the failure sheet" back={{ href: "/payments", label: "Failed payments" }}
        description="The bank’s monthly list of direct debits that failed. Each swimmer on it whose member number is on Turnfin goes on the list for reception to contact; everyone else is ignored." />}>
      <UploadForm today={today()} />
      <UploadHistory uploads={await uploadHistory()} />
    </PageShell>
  );
}
