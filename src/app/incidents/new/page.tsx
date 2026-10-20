import type { Metadata } from "next";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { ReportForm } from "@/modules/incidents/features/report";
import { reportFormData } from "@/modules/incidents/features/reports";

export const metadata: Metadata = { title: "Report an incident" };

export default async function NewIncidentPage() {
  const { sites, areas, staff, docs } = await reportFormData();
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Report an incident" back={{ href: "/incidents", label: "Reports" }}
        description="Accidents, incidents and near misses. Report what you saw: it helps the next person, and nobody is blamed for reporting." />}>
      <ReportForm sites={sites} areas={areas} staff={staff} docs={docs} />
    </PageShell>
  );
}
