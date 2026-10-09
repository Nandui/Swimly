import { randomUUID } from "node:crypto";
import { screenPage } from "@/lib/page-guards";
import { refundDefaultSite, refundSites } from "@/modules/refunds/lib/data";
import { PageHeader } from "@/components/ui-kit/page-header";
import { RefundRequestForm } from "@/modules/refunds/components/request-form";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "New refund request" };

export default async function NewRefundPage() {
  await screenPage("refunds", "refunds.request");
  const sites = await refundSites();
  return <>
    <PageHeader title="New refund request" description="Send the details to finance. They will review the request and record the refund once paid." />
    <RefundRequestForm id={randomUUID()} sites={sites} defaultSite={await refundDefaultSite(sites)} />
  </>;
}
