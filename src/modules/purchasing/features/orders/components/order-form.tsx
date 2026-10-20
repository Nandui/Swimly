"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Send, Save, TriangleAlert, UserCheck, X } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Textarea } from "@/components/shadcn/textarea";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { Notice } from "@/components/ui-kit/notice";
import { saveOrder } from "@/modules/purchasing/features/orders/server/actions";
import { approverRoles, euro, lineDetails, rulesFor, type ApprovalRule } from "@/modules/purchasing/shared/rules";
import { toast } from "@/components/ui/toast";

type Product = { id: string; name: string; code: string; unit: string; brand: string; sizes: string[]; colours: string[]; priceCents: number };
type Supplier = { id: string; name: string; products: Product[] };
type Existing = { id: string; siteId: string; supplierId: string; neededBy: Date | null; note: string; status: string; decisionNote: string; lines: { productId: string | null; size: string; colour: string; quantity: number }[] };

/** One line of the order: a product, and the size and colour picked when it comes in them. */
type LineKey = { productId: string; size: string; colour: string };
const keyOf = (l: LineKey) => JSON.stringify([l.productId, l.size, l.colour]);
const lineOf = (key: string): LineKey => { const [productId, size, colour] = JSON.parse(key) as string[]; return { productId, size, colour }; };
const hasOptions = (p: Product) => p.sizes.length > 0 || p.colours.length > 0;
const count = (value: string | undefined) => Math.max(0, Math.floor(Number(value || 0)));

/** Raise an order (or change a draft or rejected one): the site, one approved
 *  supplier, quantities of its approved products at their agreed prices. A product
 *  that comes in sizes or colours gets a line for each one picked. The total and who
 *  may approve it update as quantities change. */
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
  const [qty, setQty] = useState<Record<string, string>>(() => Object.fromEntries((existing?.lines ?? []).flatMap((l) => (l.productId ? [[keyOf({ productId: l.productId, size: l.size, colour: l.colour }), String(l.quantity)]] : []))));
  const [pick, setPick] = useState<Record<string, { size: string; colour: string }>>({});
  const [neededBy, setNeededBy] = useState(existing?.neededBy ? existing.neededBy.toISOString().slice(0, 10) : "");
  const [note, setNote] = useState(existing?.note ?? "");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const supplier = suppliers.find((s) => s.id === supplierId);
  const products = new Map((supplier?.products ?? []).map((p) => [p.id, p]));
  const lines = Object.entries(qty).flatMap(([key, value]) => {
    const line = lineOf(key);
    const product = products.get(line.productId);
    return product && count(value) > 0 ? [{ ...line, product, quantity: count(value) }] : [];
  });
  const total = lines.reduce((sum, l) => sum + l.product.priceCents * l.quantity, 0);
  const approvers = supplier ? approverRoles(rules, supplier.id, total) : [];
  const limits = supplier ? rulesFor(rules, supplier.id) : [];
  const q = query.trim().toLowerCase();
  const shown = (supplier?.products ?? []).filter((p) => !q || `${p.name} ${p.code} ${p.unit} ${p.brand} ${p.sizes.join(" ")} ${p.colours.join(" ")}`.toLowerCase().includes(q));
  /** The lines already picked for a product that comes in sizes or colours, in the order added. */
  const variantsOf = (p: Product) => Object.keys(qty).map(lineOf).filter((l) => l.productId === p.id);
  /** The size and colour about to be added for a product; a single option is picked already. */
  const pickOf = (p: Product) => ({ size: pick[p.id]?.size ?? (p.sizes.length === 1 ? p.sizes[0] : ""), colour: pick[p.id]?.colour ?? (p.colours.length === 1 ? p.colours[0] : "") });
  function addVariant(p: Product) {
    const key = keyOf({ productId: p.id, ...pickOf(p) });
    setQty((q) => ({ ...q, [key]: String(count(q[key]) + 1) }));
    setPick((all) => ({ ...all, [p.id]: { size: "", colour: "" } }));
  }
  const removeLine = (key: string) => setQty((q) => Object.fromEntries(Object.entries(q).filter(([k]) => k !== key)));

  function save(submit: boolean) {
    setError(null);
    start(async () => {
      const result = await saveOrder(existing?.id ?? null, { siteId, supplierId, neededBy, note, lines: lines.map((l) => ({ productId: l.productId, size: l.size, colour: l.colour, quantity: l.quantity })) }, submit);
      if (!result.ok) { setError(result.error); return; }
      toast.success(submit ? "Sent for approval" : "Draft saved");
      router.push(`/purchasing/${result.id}`);
    });
  }

  if (!sites.length) return <Notice tone="warning" title="Your role cannot raise orders at any site." />;
  if (!suppliers.length) return <Notice tone="warning" title="No approved suppliers with products yet." description="Whoever manages Purchasing approves suppliers and their products first." />;

  return (
    <div className="po-form">
      <div className="po-form-main">
        {existing?.status === "rejected" && existing.decisionNote ? <Notice tone="warning" title="It was rejected" description={existing.decisionNote} /> : null}
        <section aria-labelledby="po-where" className="po-card">
          <div className="po-step-head"><span className="po-step-n" aria-hidden="true">1</span><h2 id="po-where">Where it goes and who from</h2></div>
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
            <NativeSelect id="po-supplier" value={supplierId} onChange={(e) => { setSupplierId(e.target.value); setQty({}); setPick({}); }} required>
              <NativeSelectOption value="" disabled>Choose an approved supplier</NativeSelectOption>
              {suppliers.map((s) => <NativeSelectOption key={s.id} value={s.id}>{s.name}</NativeSelectOption>)}
            </NativeSelect>
          </div>
        </div>
        </section>

        {supplier ? (
          <section aria-labelledby="po-products" className="po-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="po-step-head"><span className="po-step-n" aria-hidden="true">2</span><h2 id="po-products">Approved products</h2></div>
              <div className="po-find">
                <Search aria-hidden="true" />
                <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a product" aria-label="Find a product" />
              </div>
            </div>
            <div className="po-lines">
            <Table>
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
                  const details = [p.brand, p.code].filter(Boolean).join(" · ");
                  const product = (
                    <TableCell className="px-3 whitespace-normal"><span className="font-medium">{p.name}</span>{details ? <span className="block text-xs text-ui-muted-foreground">{details}</span> : null}</TableCell>
                  );
                  if (!hasOptions(p)) {
                    const key = keyOf({ productId: p.id, size: "", colour: "" });
                    const n = count(qty[key]);
                    return (
                      <TableRow key={p.id} data-picked={n > 0 ? "" : undefined}>
                        {product}
                        <TableCell className="hidden px-3 text-ui-muted-foreground sm:table-cell">{p.unit || "Each"}</TableCell>
                        <TableCell className="px-3 text-right tabular-nums">{euro(p.priceCents)}</TableCell>
                        <TableCell className="px-3"><Input type="number" inputMode="numeric" min={0} max={100000} step={1} value={qty[key] ?? ""} placeholder="0"
                          onChange={(e) => setQty((q) => ({ ...q, [key]: e.target.value }))} aria-label={`Quantity of ${p.name}`} className="w-24 text-right tabular-nums" /></TableCell>
                        <TableCell className="px-3 text-right font-medium tabular-nums">{n ? euro(n * p.priceCents) : ""}</TableCell>
                      </TableRow>
                    );
                  }
                  const next = pickOf(p);
                  const ready = (!p.sizes.length || next.size) && (!p.colours.length || next.colour);
                  return (
                    <Fragment key={p.id}>
                      <TableRow className="border-b-0">
                        {product}
                        <TableCell className="hidden px-3 text-ui-muted-foreground sm:table-cell">{p.unit || "Each"}</TableCell>
                        <TableCell className="px-3 text-right tabular-nums">{euro(p.priceCents)}</TableCell>
                        <TableCell colSpan={2} className="px-3 text-xs whitespace-normal text-ui-muted-foreground">A line for each {[p.sizes.length ? "size" : "", p.colours.length ? "colour" : ""].filter(Boolean).join(" and ")}</TableCell>
                      </TableRow>
                      {variantsOf(p).map((l) => {
                        const key = keyOf(l);
                        const n = count(qty[key]);
                        const label = lineDetails({ size: l.size, colour: l.colour });
                        return (
                          <TableRow key={key} data-sub="" data-picked={n > 0 ? "" : undefined}>
                            <TableCell colSpan={3} className="px-3 pl-6">
                              <span className="flex items-center gap-1">
                                <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0" aria-label={`Remove ${p.name}, ${label}`} onClick={() => removeLine(key)}><X aria-hidden="true" /></Button>
                                <span className="text-sm">{label}</span>
                              </span>
                            </TableCell>
                            <TableCell className="px-3"><Input type="number" inputMode="numeric" min={0} max={100000} step={1} value={qty[key] ?? ""} placeholder="0"
                              onChange={(e) => setQty((q) => ({ ...q, [key]: e.target.value }))} aria-label={`Quantity of ${p.name}, ${label}`} className="w-24 text-right tabular-nums" /></TableCell>
                            <TableCell className="px-3 text-right font-medium tabular-nums">{n ? euro(n * p.priceCents) : ""}</TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow data-sub="">
                        <TableCell colSpan={5} className="px-3 pl-6">
                          <div className="flex flex-wrap items-center gap-2">
                            {p.sizes.length ? (
                              <div className="w-32"><NativeSelect value={next.size} onChange={(e) => setPick((all) => ({ ...all, [p.id]: { ...next, size: e.target.value } }))} aria-label={`Size of ${p.name}`}>
                                <NativeSelectOption value="" disabled>Size</NativeSelectOption>
                                {p.sizes.map((v) => <NativeSelectOption key={v} value={v}>{v}</NativeSelectOption>)}
                              </NativeSelect></div>
                            ) : null}
                            {p.colours.length ? (
                              <div className="w-36"><NativeSelect value={next.colour} onChange={(e) => setPick((all) => ({ ...all, [p.id]: { ...next, colour: e.target.value } }))} aria-label={`Colour of ${p.name}`}>
                                <NativeSelectOption value="" disabled>Colour</NativeSelectOption>
                                {p.colours.map((v) => <NativeSelectOption key={v} value={v}>{v}</NativeSelectOption>)}
                              </NativeSelect></div>
                            ) : null}
                            <Button type="button" variant="outline" className="min-h-11" disabled={!ready} onClick={() => addVariant(p)} aria-label={`Add a line of ${p.name}`}><Plus aria-hidden="true" />Add line</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    </Fragment>
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
            </div>
          </section>
        ) : null}

        <section aria-labelledby="po-delivery" className="po-card">
          <div className="po-step-head"><span className="po-step-n" aria-hidden="true">{supplier ? 3 : 2}</span><h2 id="po-delivery">When and anything to add</h2></div>
        <div className="grid gap-4 sm:grid-cols-auto-fill">
          <div className="space-y-2 sm:w-48"><Label htmlFor="po-needed">Needed by (optional)</Label><Input id="po-needed" type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="po-note">Note (optional)</Label><Textarea id="po-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={2} placeholder="For the approver or the supplier, for example the delivery entrance." /></div>
        </div>
        </section>
      </div>

      <aside className="min-w-0">
        <section className="po-card po-summary" aria-labelledby="po-summary">
          <span className="po-eyebrow">Summary</span>
          <h2 id="po-summary" className="po-label">Total before VAT</h2>
          <p className="po-summary-total" aria-live="polite">{euro(total)}</p>
          <dl className="po-summary-lines">
            <dt>Lines</dt><dd>{lines.length}</dd>
          </dl>
          {supplier ? (
            approvers.length ? (
              <p className="po-callout"><UserCheck aria-hidden="true" />
                <span>Approved by {approvers.map((id) => { const r = limits.find((l) => l.roleId === id); return `${roleNames[id] ?? "a role"}${r?.limitCents == null ? "" : ` (up to ${euro(r.limitCents)})`}`; }).join(" or ")}.</span></p>
            ) : (
              <p className="po-callout" data-tone="warning"><TriangleAlert aria-hidden="true" />
                <span>{limits.length ? `Nobody may approve ${euro(total)} from ${supplier.name}.` : `${supplier.name} has no approvers yet.`} Ask whoever manages Purchasing.</span></p>
            )
          ) : null}
          {error ? <p className="po-callout" data-tone="danger" role="alert">{error}</p> : null}
          <div className="po-islands">
            <Button type="button" className="min-h-11" disabled={pending || !siteId || !supplierId || lines.length === 0 || approvers.length === 0} onClick={() => save(true)}><Send aria-hidden="true" />Send for approval</Button>
            <Button type="button" variant="outline" className="min-h-11" disabled={pending || !siteId || !supplierId} onClick={() => save(false)}><Save aria-hidden="true" />Save draft</Button>
          </div>
          <p className="po-fine">It gets its number (for example BT-OCT-0042) once it is approved.</p>
        </section>
      </aside>
    </div>
  );
}
