import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { DetailsForm, detailsFormData, getRiskAssessment, RiskError } from "@/modules/risk/features/assessments";

export const metadata: Metadata = { title: "Change a risk assessment" };

/** The details of one assessment, for those who write at its site. Its hazards are changed on
 *  its own page. */
export default async function EditRiskAssessmentPage({ params }: PageProps<"/risk-assessments/[id]/edit">) {
  const { id } = await params;
  const { assessment, can } = await getRiskAssessment(id).catch((error) => {
    if (error instanceof RiskError) notFound();
    throw error;
  });
  if (!can.write) notFound();
  const data = await detailsFormData(assessment.siteId, assessment.siteId);
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Change details" back={{ href: `/risk-assessments/${id}`, label: assessment.reference }}
        description={`${assessment.subject} at ${assessment.siteName}. Its hazards are changed on the assessment itself.`} />}>
      <DetailsForm data={data} assessment={assessment} />
    </PageShell>
  );
}
