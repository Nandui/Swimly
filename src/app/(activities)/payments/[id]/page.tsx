import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { FailureView, getPaymentFailure, PaymentError } from "@/modules/activities/features/failed-payments";

/** One query per failure, shared by the page and its tab title. */
const load = cache(getPaymentFailure);

export async function generateMetadata({ params }: PageProps<"/payments/[id]">): Promise<Metadata> {
  const { id } = await params;
  try {
    return { title: (await load(id)).failure.name };
  } catch (error) {
    // The page turns these into a 404, so the title is the 404 page's.
    if (error instanceof PaymentError) return { title: "Page not found" };
    throw error;
  }
}

export default async function PaymentFailurePage({ params }: PageProps<"/payments/[id]">) {
  const { id } = await params;
  const data = await load(id).catch((error) => {
    if (error instanceof PaymentError) notFound();
    throw error;
  });
  return <FailureView data={data} />;
}
