import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarClock, Check, Mail, MapPin, Pencil, TriangleAlert, Truck, UserRound } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { PageHeader } from "@/components/ui-kit/page-header";
import { ApproveOrder, CancelOrder, EmailHistory, euro, lastSentToSupplier, PoStatusTag, PrintOrder, purchaseOrder, RejectOrder } from "@/modules/purchasing/features/orders";
import { formatDate, formatDateTime, plural } from "@/lib/format";

export const metadata: Metadata = { title: "Purchase order" };

type Order = Awaited<ReturnType<typeof purchaseOrder>>["order"];
type StepState = "done" | "current" | "stopped" | "todo";

/** One purchase order. On screen it opens as a bento: the order and its four steps across
 *  the top, the document as the supplier receives it (number, supplier, where it goes, the
 *  lines and the total) on the left, and what happens next with this person's actions and
 *  its emails on the right. Printed, only the heading and the document remain. Approvers
 *  decide it here; its requester changes or cancels it until it is approved. */
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { order: o, canApprove, canEdit, canCancel, canEmail, approverRoles } = await purchaseOrder((await params).id);
  const total = euro(o.totalCents);
  const sent = lastSentToSupplier(o.emails);
  const units = o.lines.reduce((t, l) => t + l.quantity, 0);
  return (
    <div className="po-desk">
      <PageHeader title={<span className="po-num">{o.number ?? "Purchase order"}</span>} back={{ href: "/purchasing", label: "Orders" }}
        status={<PoStatusTag status={o.status} />}
        description={`${o.supplier.name} · ${o.site.name} · ${total} before VAT`}
        actions={o.status === "approved" ? <span data-print="hide" className="flex flex-wrap gap-2"><PrintOrder /></span> : null} />

      <div className="po-bento">
        <section aria-labelledby="po-what-h" className="po-card po-hero" data-print="hide">
          <div className="po-hero-main">
            <span className="po-eyebrow">{o.number ? "Purchase order" : o.status === "draft" ? "Draft order" : "Order request"}</span>
            <h2 id="po-what-h" className="po-headline">{o.supplier.name}</h2>
            <ul className="po-where">
              <li><MapPin aria-hidden="true" />{o.site.name}</li>
              <li><UserRound aria-hidden="true" />Raised by {o.requestedByName}</li>
              {o.neededBy ? <li><CalendarClock aria-hidden="true" />Needed by {formatDate(o.neededBy)}</li> : null}
            </ul>
          </div>
          <div className="po-total" data-status={o.status}>
            <p className="po-label">Total before VAT</p>
            <p className="po-total-n">{total}</p>
            <p className="po-muted">{plural(o.lines.length, "line")} · {plural(units, "item")}</p>
          </div>
          <Steps o={o} />
        </section>

        <article className="po-card po-doc" aria-label="The purchase order">
          <div className="po-parties">
            <div className="po-well">
              <h2>Supplier</h2>
              <p className="po-well-lead">{o.supplier.name}</p>
              {o.supplier.accountNumber ? <p>Our account: {o.supplier.accountNumber}</p> : null}
              {[o.supplier.contactName, o.supplier.email, o.supplier.phone].filter(Boolean).map((v) => <p key={v} className="po-well-quiet">{v}</p>)}
            </div>
            <div className="po-well">
              <h2>Deliver to</h2>
              <p className="po-well-lead">{o.site.name}</p>
              {o.address ? <p className="whitespace-pre-line">{o.address}</p> : null}
              {o.neededBy ? <p>Needed by {formatDate(o.neededBy)}</p> : null}
            </div>
            <div className="po-well">
              <h2>Order</h2>
              <p className="po-well-lead po-num">{o.number ?? "Not numbered until approved"}</p>
              <p>Raised by {o.requestedByName}, {formatDate(o.submittedAt ?? o.createdAt)}</p>
              {o.status === "approved" && o.decidedByName ? <p>Approved by {o.decidedByName}</p> : null}
            </div>
          </div>

          <div className="po-lines">
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
                  const chips = [l.brand, l.size ? `Size ${l.size}` : "", l.colour].filter(Boolean);
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="whitespace-normal">
                        <span className="font-semibold">{l.name}</span>
                        <span className="block text-ui-muted-foreground">{[l.code ? `Code ${l.code}` : "", l.unit || "Each"].filter(Boolean).join(" · ")}</span>
                        {chips.length ? <span className="block">{chips.map((c) => <span key={c} className="po-chip">{c}</span>)}</span> : null}
                      </TableCell>
                      <TableCell className="text-right"><span className="po-qty">{l.quantity}</span></TableCell>
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
                  <TableCell className="text-right font-extrabold tabular-nums">{total}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
          {o.note ? <div className="po-note"><h2 className="po-label">Note</h2><p>{o.note}</p></div> : null}
          {o.status !== "approved" ? <p className="po-doc-foot"><TriangleAlert aria-hidden="true" />Not a purchase order until it is approved and numbered.</p> : null}
        </article>

        <div className="po-bento-side" data-print="hide">
          <NextStep o={o} approverRoles={approverRoles} sent={sent} canApprove={canApprove} actions={
            canApprove || canEdit || canEmail || canCancel ? (
              <div className="po-islands">
                {canApprove ? <><ApproveOrder id={o.id} total={total} /><RejectOrder id={o.id} /></> : null}
                {canEmail ? <Button asChild className="min-h-11"><Link href={`/purchasing/${o.id}/email`}><Mail aria-hidden="true" />Email to supplier</Link></Button> : null}
                {canEdit ? <Button asChild variant={o.status === "rejected" ? "default" : "outline"} className="min-h-11"><Link href={`/purchasing/${o.id}/edit`}><Pencil aria-hidden="true" />Change</Link></Button> : null}
                {canCancel ? <CancelOrder id={o.id} /> : null}
              </div>
            ) : null} />
          <EmailHistory emails={o.emails} />
        </div>
      </div>
    </div>
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
  return (
    <ol className="po-steps" aria-label="Where the order has got to">
      {steps.map((s) => (
        <li key={s.label} data-state={s.state} aria-current={s.state === "current" ? "step" : undefined}>
          <span className="po-step-dot">{s.state === "done" ? <Check aria-hidden="true" /> : s.state === "stopped" ? <TriangleAlert aria-hidden="true" /> : null}</span>
          <span className="po-step-label">{s.label}</span>
          {s.hint ? <span className="po-step-hint">{s.hint}</span> : null}
        </li>
      ))}
    </ol>
  );
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
    <section aria-labelledby="po-next-h" className="po-card po-next" data-tone={tone}>
      <span className="po-eyebrow">{tone === "done" ? <Truck aria-hidden="true" className="size-3" /> : null}{eyebrow}</span>
      <h2 id="po-next-h" className="po-next-title">{title}</h2>
      <p className="po-muted">{body}</p>
      {quote ? <p className="po-quote" data-tone="danger">{quote}</p> : null}
      {actions}
    </section>
  );
}
