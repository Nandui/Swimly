import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { AssessmentView, getRiskAssessment, RiskError } from "@/modules/risk/features/assessments";
import { HazardSection } from "@/modules/risk/features/hazards";
import { ReviewNow, ReviewsSection } from "@/modules/risk/features/reviews";

/** One query per assessment, shared by the page and its tab title. */
const load = cache(getRiskAssessment);

export async function generateMetadata({ params }: PageProps<"/risk-assessments/[id]">): Promise<Metadata> {
  const { id } = await params;
  try {
    const { assessment } = await load(id);
    return { title: `${assessment.reference} ${assessment.subject}` };
  } catch (error) {
    // The page turns these into a 404, so the title is the 404 page's.
    if (error instanceof RiskError) return { title: "Page not found" };
    throw error;
  }
}

export default async function RiskAssessmentPage({ params }: PageProps<"/risk-assessments/[id]">) {
  const { id } = await params;
  const data = await load(id).catch((error) => {
    if (error instanceof RiskError) notFound();
    throw error;
  });
  const reviewDue = data.can.review && (data.review.state === "overdue" || data.review.state === "due");
  return <AssessmentView data={data} hazards={<HazardSection data={data} />} reviews={<ReviewsSection data={data} />} reviewNow={reviewDue ? <ReviewNow data={data} /> : undefined} />;
}
