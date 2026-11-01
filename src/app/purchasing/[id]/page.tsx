import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Mail, Pencil, TriangleAlert } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Notice } from "@/components/ui-kit/notice";
import { PageShell } from "@/components/ui-kit/page-shell";
import { RecordFacts, RecordNext, RecordSection, RecordSteps, type RecordStepState } from "@/components/ui-kit/record";
import { ApproveOrder, CancelOrder, EmailHistory, euro, lastSentToSupplier, PoStatusTag, PrintOrder, purchaseOrder, RejectOrder } from "@/modules/purchasing/features/orders";
import { SupplierPicture } from "@/modules/purchasing/features/suppliers";
import { formatDate, formatDateTime, plural } from "@/lib/format";

export const metadata: Metadata = { title: "Purchase order" };

type Order = Awaited<ReturnType<typeof purchaseOrder>>["order"];
type StepState = RecordStepState;

/** One purchase order as a record page (ui-kit/record.tsx, after Refunds): what happens next with
 *  this person's actions and the four steps beside the order, then the supplier, where it goes,
 *  the lines and the total, and its emails. Printed, only the heading and the order remain.
 *  Approvers decide it here; its requester changes or cancels it until it is approved. */
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { order: o, canApprove, canEdit, canCancel, canEmail, approverRoles } = await purchaseOrder((await params).id);
  const total = euro(o.totalCents);
  const sent = lastSentToSupplier(o.emails);
  const units = o.lines.reduce((t, l) => t + l.quantity, 0);
  return (
    <PageShell spacing="roomy" header={<PageHeader title={<span className="tabular-nums">{o.number ?? "Purchase order"}</span>} back={{ href: "/purchasing", label: "Orders" }}
        eyebrow={<p className="rec-head"><PoStatusTag status={o.status} /><span>{o.number ? "Purchase order" : o.status === "draft" ? "Draft order" : "Order request"}</span></p>}
        description={`${o.supplier.name} · ${o.site.name} · ${total} before VAT`}
        actions={o.status === "approved" ? <span data-print="hide" className="flex flex-wrap gap-2"><PrintOrder /></span> : null} />}>

      <div className="rec-layout">
        <NextStep o={o} approverRoles={approverRoles} sent={sent} canApprove={canApprove} actions={
          canApprove || canEdit || canEmail || canCancel ? (
            <div className="flex flex-col gap-2">
              {canApprove ? <><ApproveOrder id={o.id} total={total} /><RejectOrder id={o.id} /></> : null}
              {canEmail ? <Button asChild className="min-h-11"><Link href={`/purchasing/${o.id}/email`}><Mail aria-hidden="true" />Email to supplier</Link></Button> : null}
              {canEdit ? <Button asChild variant={o.status === "rejected" ? "default" : "outline"} className="min-h-11"><Link href={`/purchasing/${o.id}/edit`}><Pencil aria-hidden="true" />Change</Link></Button> : null}
              {canCancel ? <CancelOrder id={o.id} /> : null}
            </div>
          ) : null} />

        <div className="rec-main">
          <RecordSection id="po-supplier-h" title="Supplier">
            <div className="rec-card">
              <div className="flex min-w-0 items-center gap-3">
                <SupplierPicture id={o.supplier.id} name={o.supplier.name} version={o.supplier.pictureVersion} />
                <span className="min-w-0 font-semibold">{o.supplier.name}</span>
              </div>
              <RecordFacts items={[
                ["Our account", o.supplier.accountNumber || "Not recorded"],
                ...([["Contact", o.supplier.contactName], ["Email", o.supplier.email], ["Phone", o.supplier.phone]] as [string, string][]).filter(([, v]) => v),
              ]} />
            </div>
          </RecordSection>
          <RecordSection id="po-deliver-h" title="Deliver to">
            <div className="rec-card">
              <RecordFacts items={[
                ["Site", o.site.name],
                ...(o.address ? [["Address", <span key="a" className="whitespace-pre-line">{o.address}</span>, true] as [string, ReactNode, boolean]] : []),
                ["Needed by", o.neededBy ? formatDate(o.neededBy) : "No date given"],
                ["Raised by", `${o.requestedByName}, ${formatDate(o.submittedAt ?? o.createdAt)}`],
                ...(o.status === "approved" && o.decidedByName ? [["Approved by", o.decidedByName] as [string, string]] : []),
              ]} />
            </div>
          </RecordSection>
          <RecordSection id="po-lines-h" title="What is ordered" aside={<p>{plural(o.lines.length, "line")} · {plural(units, "item")}</p>}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right max-md:hidden">Price</TableHead>
                  <TableHead className="text-right">Line</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {o.lines.map((l) => {
                  const details = [l.code ? `Code ${l.code}` : "", l.unit || "Each", l.brand, l.size ? `Size ${l.size}` : "", l.colour].filter(Boolean);
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="whitespace-normal">
                        <span className="font-semibold">{l.name}</span>
                        <span className="block text-xs text-ui-muted-foreground">{details.join(" · ")}</span>
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{l.quantity}</TableCell>
                      <TableCell className="text-right tabular-nums max-md:hidden">{euro(l.unitPriceCents)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{euro(l.unitPriceCents * l.quantity)}</TableCell>
                    </TableRow>
                  );
                })}
                {o.lines.length === 0 ? <TableRow><TableCell colSpan={4} className="py-6 text-center text-ui-muted-foreground">No products on it yet.</TableCell></TableRow> : null}
              </TableBody>
              <TableFooter className="bg-transparent">
                <TableRow>
                  <TableCell colSpan={2} className="text-right font-semibold">Total before VAT</TableCell>
                  <TableCell className="max-md:hidden" />
                  <TableCell className="text-right font-bold tabular-nums">{total}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </RecordSection>
          {o.note ? <RecordSection id="po-note-h" title="Note"><div className="rec-card"><p className="whitespace-pre-line">{o.note}</p></div></RecordSection> : null}
          {o.status !== "approved" ? <Notice tone="warning" icon={TriangleAlert} title="Not a purchase order until it is approved and numbered." /> : null}
        </div>

        <div className="rec-side" data-print="hide">
          <EmailHistory emails={o.emails} />
        </div>
      </div>
    </PageShell>
  );
}

/** Raised, sent for approval, approved and numbered, emailed to the supplier. */
function Steps({ o }: { o: Order }) {
  const lastEmail = o.emails.find((e) => e.kind === "supplier" && e.status === "sent");
  const decided = o.decidedAt ? formatDate(o.decidedAt) : "";
  const approval: [StepState, string] =
    o.status === "approved" ? ["done", [o.number, decided].filter(Boolean).join(", ")]
    : o.status === "rejected" ? ["stopped", `Rejected by ${o.decidedByName ?? "an approver"}`]
    : o.status === "cancelled" ? ["stopped", "Cancelled, never numbered"]
    : o.status === "pending" ? ["current", "Waiting for an approver"]
    : ["todo", "Gets its number here"];
  const steps: { label: string; state: StepState; hint: string }[] = [
    { label: "Raised", state: "done", hint: `${o.requestedByName}, ${formatDate(o.createdAt)}` },
    { label: "Sent for approval", state: o.submittedAt ? "done" : o.status === "draft" ? "current" : "todo", hint: o.submittedAt ? formatDate(o.submittedAt) : o.status === "draft" ? "Not sent yet" : "" },
    { label: "Approved and numbered", state: approval[0], hint: approval[1] },
    { label: "Emailed to supplier", state: lastEmail ? "done" : o.status === "approved" ? "current" : "todo", hint: lastEmail ? formatDate(lastEmail.createdAt) : o.status === "approved" ? "Not emailed yet" : "" },
  ];
  return <RecordSteps steps={steps.map((x) => ({ label: x.label, hint: x.hint, state: x.state }))} label="Where the order has got to" />;
}

/** Whose move it is, in words, with this person's actions on the order. */
function NextStep({ o, approverRoles, sent, canApprove, actions }: { o: Order; approverRoles: string[]; sent: string | null; canApprove: boolean; actions: ReactNode }) {
  const { tone, eyebrow, title, body, quote } =
    canApprove ? { tone: "act", eyebrow: "Your decision", title: "Approve or reject it", body: "Approving gives it the site's next purchase order number, ready to send to the supplier. Rejecting sends it back with your reason.", quote: null }
    : o.status === "pending" ? { tone: "wait", eyebrow: "What happens next", title: "Waiting for approval", body: approverRoles.length ? `It can be approved by ${approverRoles.join(" or ")}, never by whoever raised it unless they are an administrator.` : "Nobody may approve this much from this supplier yet. Whoever manages Purchasing can add an approver.", quote: null }
    : o.status === "rejected" ? { tone: "stopped", eyebrow: "What happens next", title: `Rejected by ${o.decidedByName}`, body: "It is back with whoever raised it, to change and send for approval again.", quote: o.decisionNote || null }
    : o.status === "draft" ? { tone: "wait", eyebrow: "What happens next", title: "A draft", body: "Only you see it until you send it for approval.", quote: null }
    : o.status === "approved" ? { tone: "done", eyebrow: sent ? "Sent" : "Ready to send", title: sent ? `Sent to ${o.supplier.name}` : "Approved and numbered", body: `Approved by ${o.decidedByName}${o.decidedAt ? ` on ${formatDateTime(o.decidedAt)}` : ""}. ${sent ? `Sent to ${o.supplier.name} ${sent}.` : `Not emailed to ${o.supplier.name} yet.`}`, quote: null }
    : { tone: "wait", eyebrow: "Closed", title: "Cancelled", body: "It stays in the record as cancelled and is never numbered.", quote: null };
  return (
    <RecordNext act={tone === "act"} label={eyebrow} title={title} body={body}>
      {quote ? <p className="rec-well whitespace-pre-line text-(--red-ink)">{quote}</p> : null}
      {actions}
      <Steps o={o} />
    </RecordNext>
  );
}
