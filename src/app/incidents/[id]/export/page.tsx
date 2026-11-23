import type { Metadata } from "next";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { DownloadButton, ExportView, incidentExport } from "@/modules/incidents/features/export";
import { incidentNumber } from "@/modules/incidents/features/reports";

export const metadata: Metadata = { title: "Incident report for the insurer" };

/** The full record of one report to read, with its PDF to download. Manage only. */
export default async function IncidentExportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await incidentExport(id);
  return (
    <PageShell spacing="roomy" header={<PageHeader title={<span className="tabular-nums">{`${incidentNumber(data.report.number)} full record`}</span>} back={{ href: `/incidents/${id}`, label: "The report" }} actions={<DownloadButton id={id} />} />}>
      <ExportView data={data} />
    </PageShell>
  );
}
