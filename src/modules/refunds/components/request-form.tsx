"use client";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CircleHelp, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { LoadingButton } from "@/components/ui/loading-button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Notice } from "@/components/ui-kit/notice";
import { saveRefund } from "@/modules/refunds/lib/actions";
import { refundNextStep, refundServices, type RefundFields, type RefundView } from "@/modules/refunds/lib/types";

/** The request form and its save and submit buttons, which share one pending state. On a new
 *  request the buttons sit in a sticky bar at the foot of the form (RFNew); on an editable
 *  request they lead the Next action panel beside the form (RFDetail), with `actions` (the
 *  withdraw step) under them and `children` (receipts, history) under the form. */
export function RefundRequestForm({ id, row, sites, defaultSite = "", actions, children }: {
  id: string; row?: RefundView; sites: { id: string; name: string }[]; defaultSite?: string; actions?: ReactNode; children?: ReactNode;
}) {
  const router = useRouter();
  const [fields, setFields] = useState<RefundFields>(() => ({ clubId: row?.clubId || defaultSite, customerName: row?.customerName || "", contactEmail: row?.contactEmail || "", contactPhone: row?.contactPhone || "", memberNumber: row?.memberNumber || "", service: row?.service || "", description: row?.description || "", amount: row?.requestedCents ? (row.requestedCents / 100).toFixed(2) : "", paymentDate: row?.paymentDate || "", paymentReference: row?.paymentReference || "", reason: row?.reason || "" }));
  const [pending, setPending] = useState<"save" | "submit" | null>(null), [message, setMessage] = useState<{ error?: string; warning?: string } | null>(null);
  const operation = useRef<{ key: string; id: string } | null>(null);
  const change = (key: keyof RefundFields, value: string) => setFields(previous => ({ ...previous, [key]: value }));
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "submit" ? "submit" : "save";
    const submittedFields = Object.fromEntries(new FormData(event.currentTarget)) as RefundFields;
    setFields(submittedFields);
    const payload = { id, version: row?.version || 0, fields: submittedFields, action } as const;
    const key = JSON.stringify(payload);
    if (operation.current?.key !== key) operation.current = { key, id: crypto.randomUUID() };
    setPending(action); setMessage(null);
    try {
      const result = await saveRefund({ ...payload, operationId: operation.current.id });
      if (!result.ok) { setMessage({ error: result.error }); return; }
      operation.current = null;
      if (result.warning) setMessage({ warning: result.warning });
      else setMessage({ warning: action === "submit" ? "Request submitted to finance." : "Draft changes saved." });
      router.push(`/refunds/${result.id}`); router.refresh();
    } catch { setMessage({ error: "Could not confirm the save. Your entries are still here; try again." }); }
    finally { setPending(null); }
  }
  const input = (key: keyof RefundFields) => ({ id: `refund-${key}`, name: key, value: fields[key], onChange: (value: string) => change(key, value) });
  const text = (key: keyof RefundFields) => ({ id: `refund-${key}`, name: key, value: fields[key], onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => change(key, event.target.value) });
  const resubmit = row?.status === "NEEDS_INFORMATION";
  const feedback = message && <Notice tone={message.error ? "error" : "info"} live={message.error ? "alert" : "status"} title={message.error || message.warning} />;
  // Save comes first in the document, so Enter in a field saves a draft and never submits.
  const buttons = <>
    <LoadingButton type="submit" form="refund-form" value="save" variant="outline" pending={pending === "save"} pendingLabel="Saving…" disabled={pending === "submit"}>{resubmit ? "Save changes" : "Save draft"}</LoadingButton>
    <LoadingButton type="submit" form="refund-form" value="submit" pending={pending === "submit"} pendingLabel="Submitting…" disabled={pending === "save"}><Send aria-hidden="true" />{resubmit ? "Resubmit to finance" : "Submit to finance"}</LoadingButton>
  </>;
  const form = <form id="refund-form" method="post" onSubmit={save} className="refund-request-form">
    <fieldset disabled={pending !== null} className="min-w-0">
      <legend className="sr-only">Refund request details</legend>
      <section className="pc-panel" aria-labelledby="customer-heading"><h2 id="customer-heading" className="text-lg font-semibold">Customer and service</h2>
        <div className="refund-fields">
          <Input label="Customer name" {...input("customerName")} maxLength={200} />
          <Input label="Member number" optional {...input("memberNumber")} maxLength={80} />
          <Input label="Contact email" optional {...input("contactEmail")} type="email" maxLength={254} />
          <Input label="Contact phone" optional {...input("contactPhone")} type="tel" maxLength={80} />
          <Select id="refund-site" name="clubId" label="Site" value={fields.clubId} onValueChange={value => change("clubId", value)} placeholder="Choose a site" required options={sites.map(site => ({ value: site.id, label: site.name }))} />
          <Select id="refund-service" name="service" label="Service" value={fields.service} onValueChange={value => change("service", value)} placeholder="Choose a service" required options={Object.entries(refundServices).map(([value, label]) => ({ value, label }))} />
          <Textarea label="Service description" className="refund-wide" {...text("description")} maxLength={2000} placeholder="What was purchased, and which booking or period does it cover?" />
        </div>
      </section>
      <section className="pc-panel" aria-labelledby="payment-heading"><h2 id="payment-heading" className="text-lg font-semibold">Original payment and refund</h2>
        <div className="refund-fields">
          <Input label="Requested refund (€)" {...input("amount")} inputMode="decimal" maxLength={24} />
          <Input label="Original payment date" {...input("paymentDate")} type="date" />
          <Input label="Original payment reference" {...input("paymentReference")} maxLength={200} description="The reference from Legend, a receipt or your payment system. Do not enter card or bank details." />
          <Textarea label="Reason for refund" className="refund-wide" {...text("reason")} maxLength={4000} rows={4} />
        </div>
      </section>
      <p className="pc-note text-sm"><CircleHelp aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ui-primary" /><span>A draft needs only the site and service. Before submitting, also add the customer name, service description, refund amount, original payment date and reference, and the reason.{row ? "" : " Save a draft first to add receipts."}</span></p>
    </fieldset>
    {row ? null : <>
      {feedback}
      <div className="refund-submit-bar"><p className="font-semibold">Not submitted yet</p><div className="refund-submit-buttons">{buttons}</div></div>
    </>}
  </form>;
  if (!row) return form;
  return <div className="refund-detail-columns">
    <div className="refund-main">{form}{children}</div>
    <aside className="pc-panel refund-action-panel" aria-labelledby="next-action">
      <h2 id="next-action" className="text-lg font-semibold">Next action</h2>
      <p className="text-sm text-ui-muted-foreground">{refundNextStep(row.status)}</p>
      {feedback}
      <div className="refund-action-buttons">{buttons}</div>
      {actions}
    </aside>
  </div>;
}
