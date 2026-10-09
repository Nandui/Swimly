import type { Metadata } from "next";
import Link from "next/link";
import { FilePlus2 } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { AddRule, ArchiveProduct, ArchiveSupplier, ProductDialog, RemoveRule, SupplierDialog } from "@/modules/purchasing/components/suppliers";
import { supplierPage } from "@/modules/purchasing/lib/data";
import { APPROVAL_LIST_META, euro } from "@/modules/purchasing/lib/rules";

export const metadata: Metadata = { title: "Supplier" };

/** One supplier: its details, its approved products and prices, and who
 *  approves its orders (its own approvers replace the general ones). */
export default async function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { who, supplier: s, roles, general } = await supplierPage((await params).id);
  const live = s.products.filter((p) => !p.archivedAt);
  const limit = (cents: number | null) => (cents === null ? "Any amount" : `Up to ${euro(cents)}`);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={s.name} back={{ href: "/purchasing/suppliers", label: "Suppliers" }}
        status={s.archivedAt ? <Tag meta={APPROVAL_LIST_META.removed} /> : undefined}
        description={[s.accountNumber ? `Our account ${s.accountNumber}` : null, s.contactName, s.email, s.phone, s.note].filter(Boolean).join(" · ") || "No contact details yet."}
        actions={<>
          {who.manage ? <><ArchiveSupplier id={s.id} name={s.name} archived={!!s.archivedAt} /><SupplierDialog supplier={s} /></> : null}
          {who.request && !s.archivedAt && live.length ? <Button asChild><Link href={`/purchasing/new?supplier=${s.id}`}><FilePlus2 aria-hidden="true" />New order</Link></Button> : null}
        </>} />

      <section aria-labelledby="sup-products" className="pc-panel">
        <div className="pc-panel-head">
          <h2 id="sup-products">Approved products · {live.length}</h2>
          {who.manage ? <ProductDialog supplierId={s.id} /> : null}
        </div>
        {s.products.length === 0 ? (
          <EmptyState compact icon="clipboardList" title="No approved products yet" hint="Orders from this supplier list only these, at their agreed prices." />
        ) : (
          <ul className="pc-rows">
            {s.products.map((p) => (
              <li key={p.id} className="pc-row">
                <span className="pc-row-body">
                  <span className="pc-row-title">{p.name}</span>
                  <span className="pc-row-hint">{[p.code, p.unit || "Each"].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="pc-row-trail">
                  {p.archivedAt ? <Tag meta={APPROVAL_LIST_META.removed} /> : null}
                  <span className="font-semibold tabular-nums">{euro(p.priceCents)}</span>
                  {who.manage ? <><ProductDialog supplierId={s.id} product={p} /><ArchiveProduct id={p.id} name={p.name} archived={!!p.archivedAt} /></> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="sup-rules" className="pc-panel">
        <div className="pc-panel-head">
          <div className="flex flex-col gap-1">
            <h2 id="sup-rules">Who approves its orders</h2>
            <p className="pc-row-hint">
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
                <span className="pc-row-body"><span className="pc-row-title">{r.role.name}</span><span className="pc-row-hint">{limit(r.limitCents)}</span></span>
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
