"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Save, Ticket } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { Textarea } from "@/components/shadcn/textarea";
import { Notice } from "@/components/ui-kit/notice";
import { saveBatch } from "@/lib/vouchers/actions";
import { DEFAULT_TERMS, MAX_BATCH } from "@/lib/vouchers/rules";
import { toast } from "@/lib/toast";

type Existing = { id: string; occasion: string; recipient: string; contactName: string; contactDetail: string; service: string; quantity: number; validFrom: string; validUntil: string; siteIds: string[]; terms: string; note: string };

/** Make a batch of vouchers for one community or organisation, or change one.
 *  The number of vouchers is fixed once made: the codes may already be printed. */
export function BatchForm({ sites, today, suggestions, existing }: {
  sites: { id: string; name: string }[];
  today: string;
  suggestions: { occasions: string[]; services: string[]; recipients: string[] };
  existing: Existing | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    occasion: existing?.occasion ?? suggestions.occasions[0] ?? "", recipient: existing?.recipient ?? "", contactName: existing?.contactName ?? "", contactDetail: existing?.contactDetail ?? "",
    service: existing?.service ?? suggestions.services[0] ?? "Family swim", quantity: existing ? String(existing.quantity) : "",
    validFrom: existing?.validFrom ?? today, validUntil: existing?.validUntil ?? "", terms: existing?.terms ?? DEFAULT_TERMS, note: existing?.note ?? "",
  });
  const [siteIds, setSiteIds] = useState<string[]>(existing?.siteIds ?? sites.map((s) => s.id));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  if (!sites.length) return <Notice tone="warning" title="Your role cannot give out vouchers at any site." />;

  return (
    <form className="pc-panel max-w-3xl" onSubmit={(e) => {
      e.preventDefault();
      setError(null);
      start(async () => {
        const result = await saveBatch(existing?.id ?? null, { ...form, siteIds });
        if (!result.ok) { setError(result.error); return; }
        toast.success(existing ? "Batch saved" : "Vouchers made");
        router.push(`/vouchers/batches/${result.id}`);
      });
    }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="vb-occasion">Occasion</Label>
          <Input id="vb-occasion" value={form.occasion} onChange={set("occasion")} required minLength={2} maxLength={80} list="vb-occasions" placeholder="Christmas 2026" aria-describedby="vb-occasion-hint" />
          <datalist id="vb-occasions">{suggestions.occasions.map((o) => <option key={o} value={o} />)}</datalist>
          <p id="vb-occasion-hint" className="text-xs text-ui-muted-foreground">Batches are listed and counted under it.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="vb-recipient">Given to</Label>
          <Input id="vb-recipient" value={form.recipient} onChange={set("recipient")} required minLength={2} maxLength={120} list="vb-recipients" placeholder="The community group or organisation" />
          <datalist id="vb-recipients">{suggestions.recipients.map((r) => <option key={r} value={r} />)}</datalist>
        </div>
        <div className="space-y-2">
          <Label htmlFor="vb-contact">Contact (optional)</Label>
          <Input id="vb-contact" value={form.contactName} onChange={set("contactName")} maxLength={100} autoComplete="off" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vb-contact-detail">Their email or phone (optional)</Label>
          <Input id="vb-contact-detail" value={form.contactDetail} onChange={set("contactDetail")} maxLength={200} autoComplete="off" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="vb-service">Each voucher gives</Label>
          <Input id="vb-service" value={form.service} onChange={set("service")} required minLength={2} maxLength={80} list="vb-services" placeholder="Family swim" />
          <datalist id="vb-services">{suggestions.services.map((s) => <option key={s} value={s} />)}</datalist>
        </div>
        <div className="space-y-2">
          <Label htmlFor="vb-quantity">How many vouchers</Label>
          <Input id="vb-quantity" type="number" inputMode="numeric" min={1} max={MAX_BATCH} step={1} value={form.quantity} onChange={set("quantity")} required disabled={!!existing} aria-describedby="vb-quantity-hint" className="w-32 tabular-nums" />
          <p id="vb-quantity-hint" className="text-xs text-ui-muted-foreground">{existing ? "Fixed once made, because the codes may be printed. Make another batch to give more." : `Each gets its own code. Up to ${MAX_BATCH} in a batch.`}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="vb-from">First day they can be used</Label>
          <Input id="vb-from" type="date" value={form.validFrom} onChange={set("validFrom")} required className="w-48" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vb-until">Last day they can be used</Label>
          <Input id="vb-until" type="date" value={form.validUntil} onChange={set("validUntil")} min={form.validFrom || undefined} required className="w-48" />
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Accepted at</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          {sites.map((s) => (
            <Label key={s.id} htmlFor={`vb-site-${s.id}`} className="flex min-h-11 items-center gap-2 font-normal">
              <Checkbox id={`vb-site-${s.id}`} checked={siteIds.includes(s.id)} onCheckedChange={(v) => setSiteIds((ids) => (v === true ? [...ids, s.id] : ids.filter((x) => x !== s.id)))} />{s.name}
            </Label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="vb-terms">Small print on each voucher</Label>
        <Textarea id="vb-terms" value={form.terms} onChange={set("terms")} maxLength={400} rows={2} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="vb-note">Note for staff (optional)</Label>
        <Textarea id="vb-note" value={form.note} onChange={set("note")} maxLength={1000} rows={2} placeholder="Never printed. For example who asked for them, or who collected them." />
      </div>

      {error ? <p className="text-sm text-[var(--pc-danger)]" role="alert">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="min-h-11" disabled={pending || siteIds.length === 0}>{existing ? <Save aria-hidden="true" /> : <Ticket aria-hidden="true" />}{existing ? "Save" : "Make the vouchers"}</Button>
        <Button asChild variant="ghost" className="min-h-11"><Link href={existing ? `/vouchers/batches/${existing.id}` : "/vouchers/batches"}>Cancel</Link></Button>
      </div>
    </form>
  );
}
