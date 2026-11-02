import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { today } from "@/lib/format";
import { UploadForm } from "@/modules/payments/features/upload";
import { requirePaymentsActor } from "@/modules/payments/features/workspace";

export const metadata: Metadata = { title: "Upload the failure sheet" };

/** Manage's page: anyone else gets "not found", as for any page their role does not open. */
export default async function PaymentsUploadPage() {
  if (!(await requirePaymentsActor()).manage) notFound();
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Upload the failure sheet" back={{ href: "/payments", label: "Failed payments" }}
        description="The bank’s monthly list of direct debits that failed. Each one not already in goes on the list for reception to contact." />}>
      <UploadForm today={today()} />
    </PageShell>
  );
}
