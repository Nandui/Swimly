import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { ExportView, getRiskAssessment, PrintButton, RiskError } from "@/modules/risk/features/export";

export const metadata: Metadata = { title: "Risk assessment to print" };

/** The full record of one assessment to print or save as a PDF, for anyone who may read it. */
export default async function RiskExportPage({ params }: PageProps<"/risk-assessments/[id]/export">) {
  const { id } = await params;
  const data = await getRiskAssessment(id).catch((error) => {
    if (error instanceof RiskError) notFound();
    throw error;
  });
  return (
    <PageShell spacing="roomy" header={<PageHeader title={<span className="tabular-nums">{`${data.assessment.reference} ${data.assessment.subject}`}</span>} back={{ href: `/risk-assessments/${id}`, label: "The assessment" }} actions={<PrintButton />} />}>
      <ExportView data={data} exportedAt={new Date()} exportedBy={data.who.name} />
    </PageShell>
  );
}
