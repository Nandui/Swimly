import type { Metadata } from "next";
import Link from "next/link";
import { FilePlus2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { AddRule, APPROVAL_LIST_META, ArchiveProduct, ArchiveSupplier, euro, ProductDialog, RemoveRule, SupplierDialog, SupplierMonogram, supplierPage } from "@/modules/purchasing/features/suppliers";

export const metadata: Metadata = { title: "Supplier" };

/** One supplier: who they are across the top, its approved products and prices as tiles,
 *  and who approves its orders (its own approvers replace the general ones). */
export default async function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { who, supplier: s, roles, general } = await supplierPage((await params).id);
  const live = s.products.filter((p) => !p.archivedAt);
  const limit = (cents: number | null) => (cents === null ? "Any amount" : `Up to ${euro(cents)}`);
  const contact = [
    ["Our account", s.accountNumber],
    ["Contact", s.contactName],
    ["Orders email", s.email],
    ["Phone", s.phone],
  ].filter(([, v]) => v);
  return (
    <div className="po-desk">
      <PageHeader title={s.name} back={{ href: "/purchasing/suppliers", label: "Suppliers" }}
        status={s.archivedAt ? <Tag meta={APPROVAL_LIST_META.removed} /> : undefined}
        description={s.note || (contact.length ? undefined : "No contact details yet.")}
        actions={<>
          {who.manage ? <><ArchiveSupplier id={s.id} name={s.name} archived={!!s.archivedAt} /><SupplierDialog supplier={s} /></> : null}
          {who.request && !s.archivedAt && live.length ? <Button asChild><Link href={`/purchasing/new?supplier=${s.id}`}><FilePlus2 aria-hidden="true" />New order</Link></Button> : null}
        </>} />

      {contact.length ? (
        <section aria-labelledby="sup-who" className="po-card po-supplier-hero">
          <SupplierMonogram name={s.name} size="lg" />
          <div className="flex min-w-0 flex-col gap-3">
            <span className="po-eyebrow">Approved supplier</span>
            <h2 id="sup-who" className="sr-only">Contact details</h2>
            <ul className="po-contact">
              {contact.map(([label, v]) => <li key={label}><span className="po-label">{label}</span><span>{v}</span></li>)}
            </ul>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="sup-products" className="po-card">
        <div className="po-card-head">
          <h2 id="sup-products">Approved products<span className="po-count">{live.length}</span></h2>
          {who.manage ? <ProductDialog supplierId={s.id} /> : null}
        </div>
        {s.products.length === 0 ? (
          <EmptyState compact icon="clipboardList" title="No approved products yet" hint="Orders from this supplier list only these, at their agreed prices." />
        ) : (
          <ul className="po-tiles">
            {s.products.map((p) => (
              <li key={p.id} className="po-tile" data-muted={p.archivedAt ? "" : undefined}>
                <span className="po-tile-head">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="po-tile-name">{p.name}</span>
                    <span className="po-tile-sub">{[p.brand, p.code, p.unit || "Each"].filter(Boolean).join(" · ")}</span>
                  </span>
                  {p.archivedAt ? <Tag meta={APPROVAL_LIST_META.removed} /> : null}
                </span>
                {p.sizes.length || p.colours.length ? (
                  <span className="po-tile-facts">
                    {p.sizes.length ? <span className="po-chip">Sizes {p.sizes.join(", ")}</span> : null}
                    {p.colours.length ? <span className="po-chip">Colours {p.colours.join(", ")}</span> : null}
                  </span>
                ) : null}
                <span className="po-tile-foot">
                  <span className="po-price">{euro(p.priceCents)}<span>{p.unit && p.unit !== "Each" ? `per ${p.unit.toLowerCase()}` : "each"}</span></span>
                  {who.manage ? <span className="po-tile-actions"><ProductDialog supplierId={s.id} product={p} /><ArchiveProduct id={p.id} name={p.name} archived={!!p.archivedAt} /></span> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="sup-rules" className="po-card">
        <div className="po-card-head">
          <div>
            <h2 id="sup-rules">Who approves its orders</h2>
            <p className="po-fine">
              {s.rules.length ? "These roles, each up to its amount. They replace the approvers for every supplier."
                : general.length ? `None of its own, so the approvers for every supplier decide: ${general.map((g) => `${g.role.name} (${limit(g.limitCents).toLowerCase()})`).join(", ")}.`
                : "Nobody yet: add an approver here, or for every supplier on Suppliers."}
            </p>
          </div>
        </div>
        {s.rules.length ? (
          <ul className="pc-rows">
            {s.rules.map((r) => (
              <li key={r.id} className="pc-row">
                <span className="po-mark" data-status="approved"><ShieldCheck aria-hidden="true" /></span>
                <span className="pc-row-body"><span className="pc-row-title">{r.role.name}</span><span className="pc-row-hint po-rule-limit">{limit(r.limitCents)}</span></span>
                {who.manage ? <span className="pc-row-trail"><RemoveRule id={r.id} label={`${r.role.name} as an approver for ${s.name}`} /></span> : null}
              </li>
            ))}
          </ul>
        ) : null}
        {who.manage ? <AddRule supplierId={s.id} roles={roles} /> : null}
      </section>
    </div>
  );
}
