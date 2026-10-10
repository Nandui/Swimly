"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Send, Save, TriangleAlert, UserCheck } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Textarea } from "@/components/shadcn/textarea";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { Notice } from "@/components/ui-kit/notice";
import { saveOrder } from "@/modules/purchasing/features/orders/server/actions";
import { approverRoles, euro, rulesFor, type ApprovalRule } from "@/modules/purchasing/shared/rules";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type Product = { id: string; name: string; code: string; unit: string; priceCents: number };
type Supplier = { id: string; name: string; products: Product[] };
type Existing = { id: string; siteId: string; supplierId: string; neededBy: Date | null; note: string; status: string; decisionNote: string; lines: { productId: string | null; quantity: number }[] };

/** Raise an order (or change a draft or rejected one): the site, one approved
 *  supplier, quantities of its approved products at their agreed prices. The
 *  total and who may approve it update as quantities change. */
export function OrderForm({ sites, suppliers, rules, roleNames, existing, initialSupplier }: {
  sites: { id: string; name: string; code: string | null }[];
  suppliers: Supplier[];
  rules: ApprovalRule[];
  roleNames: Record<string, string>;
  existing: Existing | null;
  initialSupplier?: string;
}) {
  const router = useRouter();
  const [siteId, setSiteId] = useState(existing?.siteId ?? (sites.length === 1 ? sites[0].id : ""));
  const [supplierId, setSupplierId] = useState(existing?.supplierId ?? (suppliers.some((s) => s.id === initialSupplier) ? initialSupplier! : suppliers.length === 1 ? suppliers[0].id : ""));
  const [qty, setQty] = useState<Record<string, string>>(() => Object.fromEntries((existing?.lines ?? []).flatMap((l) => (l.productId ? [[l.productId, String(l.quantity)]] : []))));
  const [neededBy, setNeededBy] = useState(existing?.neededBy ? existing.neededBy.toISOString().slice(0, 10) : "");
  const [note, setNote] = useState(existing?.note ?? "");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const supplier = suppliers.find((s) => s.id === supplierId);
  const lines = (supplier?.products ?? []).map((p) => ({ product: p, quantity: Math.max(0, Math.floor(Number(qty[p.id] || 0))) })).filter((l) => l.quantity > 0);
  const total = lines.reduce((sum, l) => sum + l.product.priceCents * l.quantity, 0);
  const approvers = supplier ? approverRoles(rules, supplier.id, total) : [];
  const limits = supplier ? rulesFor(rules, supplier.id) : [];
  const q = query.trim().toLowerCase();
  const shown = (supplier?.products ?? []).filter((p) => !q || `${p.name} ${p.code} ${p.unit}`.toLowerCase().includes(q));

  function save(submit: boolean) {
    setError(null);
    start(async () => {
      const result = await saveOrder(existing?.id ?? null, { siteId, supplierId, neededBy, note, lines: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })) }, submit);
      if (!result.ok) { setError(result.error); return; }
      toast.success(submit ? "Sent for approval" : "Draft saved");
      router.push(`/purchasing/${result.id}`);
    });
  }

  if (!sites.length) return <Notice tone="warning" title="Your role cannot raise orders at any site." />;
  if (!suppliers.length) return <Notice tone="warning" title="No approved suppliers with products yet." description="Whoever manages Purchasing approves suppliers and their products first." />;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-5">
        {existing?.status === "rejected" && existing.decisionNote ? <Notice tone="warning" title="It was rejected" description={existing.decisionNote} /> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="po-site">For site</Label>
            <NativeSelect id="po-site" value={siteId} onChange={(e) => setSiteId(e.target.value)} required>
              <NativeSelectOption value="" disabled>Choose a site</NativeSelectOption>
              {sites.map((s) => <NativeSelectOption key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ""}</NativeSelectOption>)}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="po-supplier">Supplier</Label>
            <NativeSelect id="po-supplier" value={supplierId} onChange={(e) => { setSupplierId(e.target.value); setQty({}); }} required>
              <NativeSelectOption value="" disabled>Choose an approved supplier</NativeSelectOption>
              {suppliers.map((s) => <NativeSelectOption key={s.id} value={s.id}>{s.name}</NativeSelectOption>)}
            </NativeSelect>
          </div>
        </div>

        {supplier ? (
          <section aria-labelledby="po-products" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="po-products">Approved products</h2>
              <div className="relative w-full sm:w-64">
                <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ui-muted-foreground" />
                <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a product" aria-label="Find a product" className="pl-9" />
              </div>
            </div>
            <Table containerClassName="rounded-[var(--pc-radius-panel)] border border-ui-border bg-ui-card">
              <TableHeader>
                <TableRow>
                  <TableHead className="px-3">Product</TableHead>
                  <TableHead className="hidden px-3 sm:table-cell">Unit</TableHead>
                  <TableHead className="px-3 text-right">Price</TableHead>
                  <TableHead className="w-28 px-3">Quantity</TableHead>
                  <TableHead className="px-3 text-right">Line</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((p) => {
                  const n = Math.max(0, Math.floor(Number(qty[p.id] || 0)));
                  return (
                    <TableRow key={p.id} className={cn(n > 0 && "bg-[var(--pc-primary-soft)]/40")}>
                      <TableCell className="px-3 whitespace-normal"><span className="font-medium">{p.name}</span>{p.code ? <span className="block text-xs text-ui-muted-foreground">{p.code}</span> : null}</TableCell>
                      <TableCell className="hidden px-3 text-ui-muted-foreground sm:table-cell">{p.unit || "Each"}</TableCell>
                      <TableCell className="px-3 text-right tabular-nums">{euro(p.priceCents)}</TableCell>
                      <TableCell className="px-3"><Input type="number" inputMode="numeric" min={0} max={100000} step={1} value={qty[p.id] ?? ""} placeholder="0"
                        onChange={(e) => setQty((q) => ({ ...q, [p.id]: e.target.value }))} aria-label={`Quantity of ${p.name}`} className="w-24 text-right tabular-nums" /></TableCell>
                      <TableCell className="px-3 text-right font-medium tabular-nums">{n ? euro(n * p.priceCents) : ""}</TableCell>
                    </TableRow>
                  );
                })}
                {shown.length === 0 ? <TableRow><TableCell colSpan={5} className="px-3 py-6 text-center text-ui-muted-foreground">No product matches.</TableCell></TableRow> : null}
              </TableBody>
              <TableFooter className="bg-transparent">
                <TableRow>
                  <TableCell colSpan={4} className="px-3 text-right font-semibold">Total before VAT</TableCell>
                  <TableCell className="px-3 text-right text-base font-bold tabular-nums">{euro(total)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </section>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
          <div className="space-y-2"><Label htmlFor="po-needed">Needed by (optional)</Label><Input id="po-needed" type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="po-note">Note (optional)</Label><Textarea id="po-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={2} placeholder="For the approver or the supplier, for example the delivery entrance." /></div>
        </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <section className="pc-panel" aria-labelledby="po-summary">
          <div className="pc-panel-head"><h2 id="po-summary">Summary</h2></div>
          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-ui-muted-foreground">Lines</dt><dd className="text-right tabular-nums">{lines.length}</dd>
            <dt className="text-ui-muted-foreground">Total before VAT</dt><dd className="text-right text-lg font-bold tabular-nums">{euro(total)}</dd>
          </dl>
          {supplier ? (
            approvers.length ? (
              <p className="flex items-start gap-2 text-sm"><UserCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[var(--pc-success)]" />
                <span>Approved by {approvers.map((id) => { const r = limits.find((l) => l.roleId === id); return `${roleNames[id] ?? "a role"}${r?.limitCents == null ? "" : ` (up to ${euro(r.limitCents)})`}`; }).join(" or ")}.</span></p>
            ) : (
              <p className="flex items-start gap-2 text-sm text-[var(--pc-warning)]"><TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <span>{limits.length ? `Nobody may approve ${euro(total)} from ${supplier.name}.` : `${supplier.name} has no approvers yet.`} Ask whoever manages Purchasing.</span></p>
            )
          ) : null}
          {error ? <p className="text-sm text-[var(--pc-danger)]" role="alert">{error}</p> : null}
          <div className="flex flex-col gap-2">
            <Button type="button" className="min-h-11" disabled={pending || !siteId || !supplierId || lines.length === 0 || approvers.length === 0} onClick={() => save(true)}><Send aria-hidden="true" />Send for approval</Button>
            <Button type="button" variant="outline" className="min-h-11" disabled={pending || !siteId || !supplierId} onClick={() => save(false)}><Save aria-hidden="true" />Save draft</Button>
          </div>
          <p className="text-xs text-ui-muted-foreground">It gets its number (for example PO-BT-00001) once it is approved.</p>
        </section>
      </aside>
    </div>
  );
}
