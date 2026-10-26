import type { Metadata } from "next";
import Link from "next/link";
import { FilePlus2, Package, ShieldCheck } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { RecordFacts, RecordSection } from "@/components/ui-kit/record";
import { Tag } from "@/components/ui-kit/tag";
import { AddRule, APPROVAL_LIST_META, ArchiveProduct, ArchiveSupplier, euro, ProductDialog, RemoveRule, SupplierDialog, SupplierPicture, SupplierPictureControls, supplierPage } from "@/modules/purchasing/features/suppliers";

export const metadata: Metadata = { title: "Supplier" };

/** One supplier: who they are and their picture, its approved products and prices,
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
    <PageShell spacing="roomy" header={<PageHeader title={s.name} back={{ href: "/purchasing/suppliers", label: "Suppliers" }}
        status={s.archivedAt ? <Tag meta={APPROVAL_LIST_META.removed} /> : undefined}
        description={s.note || (contact.length ? undefined : "No contact details yet.")}
        actions={<>
          {who.manage ? <><ArchiveSupplier id={s.id} name={s.name} archived={!!s.archivedAt} /><SupplierDialog supplier={s} /></> : null}
          {who.request && !s.archivedAt && live.length ? <Button asChild><Link href={`/purchasing/new?supplier=${s.id}`}><FilePlus2 aria-hidden="true" />New order</Link></Button> : null}
        </>} />}>

      <RecordSection id="sup-who" title="Contact and picture">
        <div className="rec-card">
          <div className="flex min-w-0 items-center gap-3">
            <SupplierPicture id={s.id} name={s.name} version={s.pictureVersion} size="lg" />
            <span className="min-w-0 font-semibold">{s.name}</span>
          </div>
          {contact.length ? <RecordFacts items={contact.map(([label, v]) => [label as string, v as string])} /> : <p className="text-sm text-ui-muted-foreground">No contact details yet.</p>}
          {who.manage ? <SupplierPictureControls id={s.id} name={s.name} hasPicture={!!s.pictureVersion} /> : null}
        </div>
      </RecordSection>

      <RecordSection id="sup-products" title="Approved products" aside={who.manage ? <ProductDialog supplierId={s.id} /> : <p>{live.length}</p>}>
        {s.products.length === 0 ? (
          <EmptyState icon="clipboardList" title="No approved products yet" hint="Orders from this supplier list only these, at their agreed prices." />
        ) : (
          <ul className="pc-list">
            {s.products.map((p) => (
              <li key={p.id} className="pc-row" data-muted={p.archivedAt ? "" : undefined}>
                <span className="pc-tile-icon" aria-hidden="true"><Package /></span>
                <span className="pc-row-body">
                  <span className="pc-row-title">{p.name}</span>
                  <span className="pc-row-hint">{[p.brand, p.code, p.unit || "Each", p.sizes.length ? `sizes ${p.sizes.join(", ")}` : null, p.colours.length ? `colours ${p.colours.join(", ")}` : null].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="pc-row-trail">
                  {p.archivedAt ? <Tag meta={APPROVAL_LIST_META.removed} /> : null}
                  <span className="pc-row-value">{euro(p.priceCents)} {p.unit && p.unit !== "Each" ? `per ${p.unit.toLowerCase()}` : "each"}</span>
                  {who.manage ? <><ProductDialog supplierId={s.id} product={p} /><ArchiveProduct id={p.id} name={p.name} archived={!!p.archivedAt} /></> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </RecordSection>

      <section aria-labelledby="sup-rules" className="flex min-w-0 flex-col">
        <div className="pc-section-head"><h2 id="sup-rules">Who approves its orders</h2></div>
            <p className="pc-section-note">
              {s.rules.length ? "These roles, each up to its amount. They replace the approvers for every supplier."
                : general.length ? `None of its own, so the approvers for every supplier decide: ${general.map((g) => `${g.role.name} (${limit(g.limitCents).toLowerCase()})`).join(", ")}.`
                : "Nobody yet: add an approver here, or for every supplier on Suppliers."}
            </p>
        <div className="rec-card">
        {s.rules.length ? (
          <ul className="pc-rows">
            {s.rules.map((r) => (
              <li key={r.id} className="pc-row">
                <span className="pc-tile-icon" data-tone="green" aria-hidden="true"><ShieldCheck /></span>
                <span className="pc-row-body"><span className="pc-row-title">{r.role.name}</span><span className="pc-row-hint tabular-nums">{limit(r.limitCents)}</span></span>
                {who.manage ? <span className="pc-row-trail"><RemoveRule id={r.id} label={`${r.role.name} as an approver for ${s.name}`} /></span> : null}
              </li>
            ))}
          </ul>
        ) : null}
        {who.manage ? <AddRule supplierId={s.id} roles={roles} /> : null}
        </div>
      </section>
    </PageShell>
  );
}
