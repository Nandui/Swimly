"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/shadcn/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Notice } from "@/components/ui-kit/notice";
import { RefundInput, RefundSelect, RefundText } from "@/components/refunds/fields";
import { saveRefund } from "@/lib/refunds/actions";
import { refundServices, type RefundFields, type RefundView } from "@/lib/refunds/types";

export function RefundRequestForm({ id, row, sites }: { id: string; row?: RefundView; sites: { id: string; name: string }[] }) {
  const router = useRouter();
  const [fields, setFields] = useState<RefundFields>(() => ({ clubId: row?.clubId || sites[0]?.id || "", customerName: row?.customerName || "", contactEmail: row?.contactEmail || "", contactPhone: row?.contactPhone || "", memberNumber: row?.memberNumber || "", service: row?.service || "OTHER", description: row?.description || "", amount: row?.requestedCents ? (row.requestedCents / 100).toFixed(2) : "", paymentDate: row?.paymentDate || "", paymentReference: row?.paymentReference || "", reason: row?.reason || "" }));
  const [pending, setPending] = useState(false), [message, setMessage] = useState<{ error?: string; warning?: string } | null>(null);
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
    setPending(true); setMessage(null);
    try {
      const result = await saveRefund({ ...payload, operationId: operation.current.id });
      if (!result.ok) { setMessage({ error: result.error }); return; }
      operation.current = null;
      if (result.warning) setMessage({ warning: result.warning });
      else setMessage({ warning: action === "submit" ? "Request submitted to finance." : "Draft changes saved." });
      router.push(`/refunds/${result.id}`); router.refresh();
    } catch { setMessage({ error: "Could not confirm the save. Your entries are still here; try again." }); }
    finally { setPending(false); }
  }
  const input = (key: keyof RefundFields) => ({ id: `refund-${key}`, name: key, value: fields[key], onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => change(key, event.target.value) });
  return <form onSubmit={save} className="refund-request-form">
    <fieldset disabled={pending} className="min-w-0 space-y-6">
      <legend className="sr-only">Refund request details</legend>
      <section className="refund-panel space-y-4" aria-labelledby="customer-heading"><h2 id="customer-heading" className="text-lg font-semibold">Customer and service</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <RefundInput label="Customer name" {...input("customerName")} maxLength={200} />
          <RefundInput label="Member number (optional)" {...input("memberNumber")} maxLength={80} />
          <RefundInput label="Contact email (optional)" {...input("contactEmail")} type="email" maxLength={254} />
          <RefundInput label="Contact phone (optional)" {...input("contactPhone")} type="tel" maxLength={80} />
          <RefundSelect id="refund-site" name="clubId" label="Site" value={fields.clubId} onChange={value => change("clubId", value)} options={sites.map(site => ({ value: site.id, label: site.name }))} />
          <RefundSelect id="refund-service" name="service" label="Service" value={fields.service} onChange={value => change("service", value)} options={Object.entries(refundServices).map(([value, label]) => ({ value, label }))} />
        </div>
        <RefundText label="Service description" {...input("description")} maxLength={2000} placeholder="What was purchased, and which booking or period does it cover?" />
      </section>
      <section className="refund-panel space-y-4" aria-labelledby="payment-heading"><h2 id="payment-heading" className="text-lg font-semibold">Original payment and refund</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <RefundInput label="Requested refund (€)" {...input("amount")} inputMode="decimal" maxLength={24} />
          <RefundInput label="Original payment date" {...input("paymentDate")} type="date" />
          <RefundInput label="Original payment reference" {...input("paymentReference")} maxLength={200} hint="The reference from Legend, a receipt or your payment system. Do not enter card or bank details." />
        </div>
        <RefundText label="Reason for refund" {...input("reason")} maxLength={4000} />
      </section>
      <p className="text-sm leading-relaxed text-ui-muted-foreground">You can save an incomplete draft. Before submitting, complete the customer name, site, service description, refund amount, payment date and reference, and reason. Save a draft first to add optional receipts.</p>
      {message && <Notice tone={message.error ? "error" : "info"} title={message.error || message.warning} />}
      <div className="flex flex-wrap gap-3"><LoadingButton type="submit" value="submit" pending={pending} className="min-h-11">{row?.status === "NEEDS_INFORMATION" ? "Resubmit to finance" : "Submit to finance"}</LoadingButton><Button type="submit" value="save" variant="outline" className="min-h-11">{row?.status === "NEEDS_INFORMATION" ? "Save changes" : "Save draft"}</Button></div>
    </fieldset>
  </form>;
}
