import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { getRefund, refundSites } from "@/lib/refunds/data";
import { requireRefundActor } from "@/lib/refunds/auth";
import { RefundError } from "@/lib/refunds/rules";
import { refundNumber } from "@/lib/refunds/types";
import { RefundDetail } from "@/components/refunds/detail";

/** One query per request, shared by the page and its tab title. */
const load = cache(getRefund);

export async function generateMetadata({ params }: PageProps<"/refunds/[id]">): Promise<Metadata> {
  const { id } = await params;
  try {
    await requireRefundActor();
    return { title: refundNumber((await load(id)).request.number) };
  } catch (error) {
    // The page turns these into a 404, so the title is the 404 page's.
    if (error instanceof RefundError) return { title: "Page not found" };
    throw error;
  }
}

export default async function RefundPage({ params }: PageProps<"/refunds/[id]">) {
  const { id } = await params;
  const who = await requireRefundActor();
  const [data, sites] = await Promise.all([load(id), refundSites()]).catch(error => {
    if (error instanceof RefundError) notFound();
    throw error;
  });
  return <RefundDetail data={data} who={who} sites={sites} />;
}
