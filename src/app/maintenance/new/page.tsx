import type { Metadata } from "next";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { currentClubIdIfAny } from "@/lib/clubs/current";
import { ReportForm, reportFormData } from "@/modules/maintenance/features/report";

export const metadata: Metadata = { title: "Report a maintenance problem" };

export default async function NewMaintenancePage() {
  const { sites, areas, start } = await reportFormData(await currentClubIdIfAny());
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Report a problem" back={{ href: "/maintenance", label: "Maintenance" }}
        description="Something broken or needing repair. Say where it is and what is wrong; the site’s managers make sure the maintenance team has it." />}>
      <ReportForm sites={sites} areas={areas} start={start} />
    </PageShell>
  );
}
