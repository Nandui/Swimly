import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { currentClubIdIfAny } from "@/lib/clubs/current";
import { DetailsForm, detailsFormData } from "@/modules/risk/features/assessments";
import { requireRiskActor } from "@/modules/risk/features/workspace";

export const metadata: Metadata = { title: "Start a risk assessment" };

/** A new draft, for those who write risk assessments. */
export default async function NewRiskAssessmentPage() {
  if (!(await requireRiskActor()).write) notFound();
  const data = await detailsFormData(await currentClubIdIfAny());
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Start an assessment" back={{ href: "/risk-assessments", label: "Risk assessments" }}
        description="Say what it is about and who owns it. It starts as a draft; you add its hazards on the next page." />}>
      <DetailsForm data={data} />
    </PageShell>
  );
}
