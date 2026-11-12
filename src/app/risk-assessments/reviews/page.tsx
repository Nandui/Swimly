import type { Metadata } from "next";
import { ReviewsDue, reviewsDue } from "@/modules/risk/features/reviews";

export const metadata: Metadata = { title: "Risk assessment reviews" };

export default async function RiskReviewsPage({ searchParams }: PageProps<"/risk-assessments/reviews">) {
  const raw = await searchParams;
  return <ReviewsDue data={await reviewsDue({ site: typeof raw.site === "string" ? raw.site : undefined })} />;
}
