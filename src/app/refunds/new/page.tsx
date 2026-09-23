import { randomUUID } from "node:crypto";
import { screenPage } from "@/lib/page-guards";
import { refundSites } from "@/lib/refunds/data";
import { RefundRequestForm } from "@/components/refunds/request-form";

export default async function NewRefundPage() {
  await screenPage("refunds", "refunds.request");
  const sites = await refundSites();
  return <div className="refund-new"><div className="refund-heading"><h1 className="text-2xl font-semibold tracking-tight">New refund request</h1><p className="text-sm text-ui-muted-foreground">Send the details to finance. They will review the request and record the refund once paid.</p></div><RefundRequestForm id={randomUUID()} sites={sites} /></div>;
}
