import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, TriangleAlert, UserCheck } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { Notice } from "@/components/ui-kit/notice";
import { PageHeader } from "@/components/ui-kit/page-header";
import { ApproveOrder, CancelOrder, PrintOrder, RejectOrder } from "@/components/purchasing/order-actions";
import { PoStatusTag } from "@/components/purchasing/status";
import { formatDate, formatDateTime } from "@/lib/format";
import { purchaseOrder } from "@/lib/purchasing/data";
import { euro } from "@/lib/purchasing/rules";

export const metadata: Metadata = { title: "Purchase order" };

/** One purchase order, laid out as the supplier receives it: number, supplier,
 *  where it goes, the lines and the total. Approvers decide it here; its
 *  requester changes or cancels it until it is approved. */
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { order: o, canApprove, canEdit, canCancel, approverRoles } = await purchaseOrder((await params).id);
  const total = euro(o.totalCents);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={<span className="tabular-nums">{o.number ?? "Purchase order"}</span>} back={{ href: "/purchasing", label: "Orders" }}
        status={<PoStatusTag status={o.status} />}
        description={`${o.supplier.name} · ${o.site.name} · ${total} before VAT`}
        actions={<span data-print="hide" className="flex flex-wrap gap-2">
          {canCancel ? <CancelOrder id={o.id} /> : null}
          {canEdit ? <Button asChild variant="outline"><Link href={`/purchasing/${o.id}/edit`}><Pencil aria-hidden="true" />Change</Link></Button> : null}
          {o.status === "approved" ? <PrintOrder /> : null}
          {canApprove ? <><RejectOrder id={o.id} /><ApproveOrder id={o.id} total={total} /></> : null}
        </span>} />

      <div data-print="hide" className="space-y-3">
        {o.status === "pending" && !canApprove ? (
          <Notice title="Waiting for approval" description={approverRoles.length ? `It can be approved by ${approverRoles.join(" or ")}, never by whoever raised it.` : "Nobody may approve this much from this supplier yet. Whoever manages Purchasing can add an approver."} />
        ) : null}
        {o.status === "rejected" ? <Notice tone="warning" title={`Rejected by ${o.decidedByName}`} description={o.decisionNote || undefined} /> : null}
        {o.status === "draft" ? <Notice title="A draft" description="Only you see it until you send it for approval." /> : null}
        {o.status === "approved" ? <p className="flex items-center gap-2 text-sm text-[var(--pc-success)]"><UserCheck aria-hidden="true" className="size-4" />Approved by {o.decidedByName}{o.decidedAt ? ` on ${formatDateTime(o.decidedAt)}` : ""}. Send {o.number} to the supplier.</p> : null}
      </div>

      <article className="pc-panel flex flex-col gap-6" aria-label="The purchase order">
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="space-y-1">
            <h2 className="text-xs font-semibold tracking-wide text-ui-muted-foreground uppercase">Supplier</h2>
            <p className="font-semibold">{o.supplier.name}</p>
            {o.supplier.accountNumber ? <p className="text-sm">Our account: {o.supplier.accountNumber}</p> : null}
            {[o.supplier.contactName, o.supplier.email, o.supplier.phone].filter(Boolean).map((v) => <p key={v} className="text-sm text-ui-muted-foreground">{v}</p>)}
          </div>
          <div className="space-y-1">
            <h2 className="text-xs font-semibold tracking-wide text-ui-muted-foreground uppercase">Deliver to</h2>
            <p className="font-semibold">{o.site.name}</p>
            {o.neededBy ? <p className="text-sm">Needed by {formatDate(o.neededBy)}</p> : null}
          </div>
          <div className="space-y-1">
            <h2 className="text-xs font-semibold tracking-wide text-ui-muted-foreground uppercase">Order</h2>
            <p className="font-semibold tabular-nums">{o.number ?? "Not numbered until approved"}</p>
            <p className="text-sm">Raised by {o.requestedByName}, {formatDate(o.submittedAt ?? o.createdAt)}</p>
            {o.status === "approved" && o.decidedByName ? <p className="text-sm">Approved by {o.decidedByName}</p> : null}
          </div>
        </div>

        <Table containerClassName="rounded-[var(--pc-radius-inner)] border border-ui-border">
          <TableHeader>
            <TableRow>
              <TableHead className="px-3">Product</TableHead>
              <TableHead className="px-3">Code</TableHead>
              <TableHead className="px-3">Unit</TableHead>
              <TableHead className="px-3 text-right">Quantity</TableHead>
              <TableHead className="px-3 text-right">Price</TableHead>
              <TableHead className="px-3 text-right">Line</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {o.lines.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="px-3 font-medium whitespace-normal">{l.name}</TableCell>
                <TableCell className="px-3 text-ui-muted-foreground">{l.code || "–"}</TableCell>
                <TableCell className="px-3 text-ui-muted-foreground">{l.unit || "Each"}</TableCell>
                <TableCell className="px-3 text-right tabular-nums">{l.quantity}</TableCell>
                <TableCell className="px-3 text-right tabular-nums">{euro(l.unitPriceCents)}</TableCell>
                <TableCell className="px-3 text-right font-medium tabular-nums">{euro(l.unitPriceCents * l.quantity)}</TableCell>
              </TableRow>
            ))}
            {o.lines.length === 0 ? <TableRow><TableCell colSpan={6} className="px-3 py-6 text-center text-ui-muted-foreground">No products on it yet.</TableCell></TableRow> : null}
          </TableBody>
          <TableFooter className="bg-transparent">
            <TableRow>
              <TableCell colSpan={5} className="px-3 text-right font-semibold">Total before VAT</TableCell>
              <TableCell className="px-3 text-right text-base font-bold tabular-nums">{total}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
        {o.note ? <div className="space-y-1"><h2 className="text-xs font-semibold tracking-wide text-ui-muted-foreground uppercase">Note</h2><p className="text-sm whitespace-pre-line">{o.note}</p></div> : null}
        {o.status !== "approved" ? <p className="flex items-center gap-2 text-xs text-ui-muted-foreground"><TriangleAlert aria-hidden="true" className="size-3.5" />Not a purchase order until it is approved and numbered.</p> : null}
      </article>
    </div>
  );
}
