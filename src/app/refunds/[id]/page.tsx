import { notFound } from "next/navigation";
import { getRefund, refundSites } from "@/lib/refunds/data";
import { requireRefundActor } from "@/lib/refunds/auth";
import { RefundError } from "@/lib/refunds/rules";
import { RefundDetail } from "@/components/refunds/detail";

export default async function RefundPage({ params }: PageProps<"/refunds/[id]">) {
  const { id } = await params;
  const who = await requireRefundActor();
  const [data, sites] = await Promise.all([getRefund(id), refundSites()]).catch(error => {
    if (error instanceof RefundError) notFound();
    throw error;
  });
  return <RefundDetail data={data} who={who} sites={sites} />;
}
