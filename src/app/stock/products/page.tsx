import type { Metadata } from "next";
import { Pencil } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { plural } from "@/lib/format";
import { ARCHIVAL_STATUS_META } from "@/lib/status";
import { ArchiveProduct, CategoryTag, ProductDialog, stockProducts } from "@/modules/stock/features/products";

export const metadata: Metadata = { title: "Stock products" };

/** The product list (docs/stock.md): one list for every site. Anyone with Stock reads it; Manage keeps it. */
export default async function StockProductsPage() {
  const { who, products, categories } = await stockProducts();
  const live = products.filter((p) => !p.archivedAt).length;
  const archived = products.length - live;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Products" description={products.length ? `${plural(live, "product")} to count at every site${archived ? `, and ${archived} archived: still on old counts, not offered on new ones` : ""}.` : "One list for every site."}
        actions={who.manage && categories.length ? <ProductDialog categories={categories} /> : undefined} />
      <section className="pc-panel" aria-label="Products">
        {products.length === 0 ? <EmptyState compact icon="layers" title="No products yet" hint={who.manage ? "Add what you sell or use, and it is ready to count." : "Whoever manages Stock adds them."} /> : (
          <ul className="pc-rows">
            {products.map((p) => (
              <li key={p.id} className="pc-row" {...(p.archivedAt ? { "data-muted": "" } : {})}>
                <span className="pc-row-body">
                  <span className="pc-row-title">{p.name}</span>
                  <span className="pc-row-hint">{[`counted in ${p.unitLabel}`, p.sku ? `SKU ${p.sku}` : null, p.caseSize ? `${p.caseSize} in a case` : null, p.notes || null].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="pc-row-trail flex-wrap">
                  {p.archivedAt ? <Tag meta={ARCHIVAL_STATUS_META.archived} /> : <CategoryTag name={p.category.name} tone={p.category.tone} />}
                  {who.manage ? <>
                    <ProductDialog product={p} categories={categories} trigger={<Button variant="outline" size="icon" aria-label={`Change ${p.name}`}><Pencil aria-hidden="true" /></Button>} />
                    <ArchiveProduct id={p.id} name={p.name} archived={!!p.archivedAt} />
                  </> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
