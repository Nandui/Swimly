import type { Metadata } from "next";
import { PageHeader } from "@/components/ui-kit/page-header";
import { ExportView, incidentExport, PrintButton } from "@/modules/incidents/features/export";
import { incidentNumber } from "@/modules/incidents/features/reports";

export const metadata: Metadata = { title: "Incident report for the insurer" };

/** The full record of one report to print or save as a PDF. Manage only. */
export default async function IncidentExportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await incidentExport(id);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={<span className="tabular-nums">{`${incidentNumber(data.report.number)} full record`}</span>} back={{ href: `/incidents/${id}`, label: "The report" }} actions={<PrintButton />} />
      <ExportView data={data} />
    </div>
  );
}
