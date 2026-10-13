"use client";

import type { ReactNode } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Textarea } from "@/components/shadcn/textarea";
import { Field, FormDialog } from "@/components/form-dialog";
import { addSheetProducts, archiveCategory, archiveProduct, saveCategory, saveProduct } from "@/modules/stock/features/products/server/actions";
import { text, THEME, useRefresh } from "@/modules/stock/shared/components/form-kit";
import { COMMON_UNITS, STOCK_CATEGORY_TONE_META, STOCK_CATEGORY_TONES, type StockCategoryTone } from "@/modules/stock/shared/rules";

/** The product list's dialogs (docs/stock.md). */

// The edit button is made here rather than passed from the page, so the dialog always receives a ready
// element it can attach to (an element streamed from the page can arrive late and get wrapped in a second button).
const editButton = (name: string) => <Button variant="outline" size="icon" aria-label={`Change ${name}`}><Pencil aria-hidden="true" /></Button>;

export type ProductEdit = { id: string; name: string; categoryId: string; unitLabel: string; sku: string | null; caseSize: number | null; barcode: string | null; notes: string };
type Option = { id: string; name: string };

export function ProductDialog({ product, categories, trigger }: { product?: ProductEdit; categories: Option[]; trigger?: ReactNode }) {
  const refresh = useRefresh();
  const fid = product ? `stp-${product.id}` : "stp-new";
  // An edit keeps a category that has since been archived.
  const options = product && !categories.some((c) => c.id === product.categoryId) ? [...categories, { id: product.categoryId, name: "Archived category" }] : categories;
  return (
    <FormDialog portalClassName={THEME} width="sm:max-w-lg"
      trigger={trigger ?? (product ? editButton(product.name) : <Button><Plus aria-hidden="true" />Add a product</Button>)}
      title={product ? `Change ${product.name}` : "Add a product"} description="One list for every site. Every count of it is in the unit you give here."
      submitLabel={product ? "Save product" : "Add product"} successMessage={product ? "Product saved" : "Product added"} onSuccess={refresh}
      submit={(fd) => saveProduct(product?.id ?? null, {
        name: text(fd, "name"), categoryId: text(fd, "categoryId"), unitLabel: text(fd, "unitLabel"), sku: text(fd, "sku"),
        caseSize: text(fd, "caseSize"), barcode: text(fd, "barcode"), notes: text(fd, "notes"),
      })}>
      <Field label="Name" htmlFor={`${fid}-name`}><Input id={`${fid}-name`} name="name" required minLength={2} maxLength={120} defaultValue={product?.name} placeholder="Junior goggles, blue" className="min-h-11" /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" htmlFor={`${fid}-cat`}>
          <NativeSelect id={`${fid}-cat`} name="categoryId" required defaultValue={product?.categoryId ?? ""} className="min-h-11 w-full">
            <NativeSelectOption value="">Choose a category</NativeSelectOption>
            {options.map((c) => <NativeSelectOption key={c.id} value={c.id}>{c.name}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
        <Field label="What is one of these?" htmlFor={`${fid}-unit`} hint="For spirits, count servings rather than part bottles.">
          <Input id={`${fid}-unit`} name="unitLabel" list={`${fid}-units`} required maxLength={30} defaultValue={product?.unitLabel ?? "each"} className="min-h-11" />
        </Field>
        <datalist id={`${fid}-units`}>{COMMON_UNITS.map((u) => <option key={u} value={u} />)}</datalist>
        <Field label="SKU" htmlFor={`${fid}-sku`} optional><Input id={`${fid}-sku`} name="sku" maxLength={40} defaultValue={product?.sku ?? ""} className="min-h-11" /></Field>
        <Field label="Units in a case" htmlFor={`${fid}-case`} optional><Input id={`${fid}-case`} name="caseSize" type="number" inputMode="numeric" min={1} max={10000} defaultValue={product?.caseSize ?? ""} className="min-h-11" /></Field>
      </div>
      <Field label="Barcode" htmlFor={`${fid}-barcode`} optional hint="Not used yet. Worth keeping for scanning to count later.">
        <Input id={`${fid}-barcode`} name="barcode" inputMode="numeric" maxLength={40} defaultValue={product?.barcode ?? ""} className="min-h-11" />
      </Field>
      <Field label="Notes" htmlFor={`${fid}-notes`} optional><Textarea id={`${fid}-notes`} name="notes" maxLength={500} defaultValue={product?.notes} placeholder="Where it is kept, or anything a counter should know." /></Field>
    </FormDialog>
  );
}

export function ArchiveProduct({ id, name, archived }: { id: string; name: string; archived: boolean }) {
  const refresh = useRefresh();
  return (
    <FormDialog portalClassName={THEME} title={archived ? `Bring ${name} back?` : `Archive ${name}?`}
      description={archived ? "It is offered on new counts again." : "It stays on old counts but is no longer offered on new ones."}
      trigger={<Button type="button" variant="ghost">{archived ? "Restore" : "Archive"}</Button>}
      submitLabel={archived ? "Restore" : "Archive"} successMessage={archived ? "Product restored" : "Product archived"} onSuccess={refresh}
      submit={() => archiveProduct(id, !archived)}>
      <p className="text-sm text-ui-muted-foreground">Nothing else changes.</p>
    </FormDialog>
  );
}

export type CategoryEdit = { id: string; name: string; tone: string };

export function CategoryDialog({ category, trigger }: { category?: CategoryEdit; trigger?: ReactNode }) {
  const refresh = useRefresh();
  const fid = category ? `stc-${category.id}` : "stc-new";
  return (
    <FormDialog portalClassName={THEME}
      trigger={trigger ?? (category ? editButton(category.name) : <Button><Plus aria-hidden="true" />Add a category</Button>)}
      title={category ? `Change ${category.name}` : "Add a category"} description="Products are grouped by category on the count sheet, in this order."
      submitLabel={category ? "Save category" : "Add category"} successMessage={category ? "Category saved" : "Category added"} onSuccess={refresh}
      submit={(fd) => saveCategory(category?.id ?? null, { name: text(fd, "name"), tone: text(fd, "tone") as StockCategoryTone })}>
      <Field label="Name" htmlFor={`${fid}-name`}><Input id={`${fid}-name`} name="name" required minLength={2} maxLength={40} defaultValue={category?.name} placeholder="Retail" className="min-h-11" /></Field>
      <Field label="Colour" htmlFor={`${fid}-tone`} hint="Red is kept for what needs attention.">
        <NativeSelect id={`${fid}-tone`} name="tone" defaultValue={category?.tone ?? "gray"} className="min-h-11 w-full">
          {STOCK_CATEGORY_TONES.map((t) => <NativeSelectOption key={t} value={t}>{STOCK_CATEGORY_TONE_META[t].label}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
    </FormDialog>
  );
}

export function ArchiveCategory({ id, name, archived }: { id: string; name: string; archived: boolean }) {
  const refresh = useRefresh();
  return (
    <FormDialog portalClassName={THEME} title={archived ? `Restore ${name}?` : `Archive ${name}?`}
      description={archived ? "It can be chosen for products again." : "It can no longer be chosen for products. Only a category with no products in use can be archived."}
      trigger={<Button type="button" variant="ghost">{archived ? "Restore" : "Archive"}</Button>}
      submitLabel={archived ? "Restore" : "Archive"} successMessage={archived ? "Category restored" : "Category archived"} onSuccess={refresh}
      submit={() => archiveCategory(id, !archived)}>
      <p className="text-sm text-ui-muted-foreground">Nothing else changes.</p>
    </FormDialog>
  );
}

/** The Bishopstown stock sheet's names, added once as a starting list. */
export function AddSheetProducts({ missing }: { missing: number }) {
  const refresh = useRefresh();
  return (
    <FormDialog portalClassName={THEME} title="Add the Bishopstown stock sheet?"
      description={`${missing} product names from the stock sheet go on the list, under Other, counted "each". Change each one's category and unit afterwards.`}
      trigger={<Button type="button" variant="outline">Add the Bishopstown stock sheet</Button>}
      submitLabel="Add products" successMessage="Products added" onSuccess={refresh} submit={() => addSheetProducts()}>
      <p className="text-sm text-ui-muted-foreground">Names already on the list are skipped. Nothing else changes.</p>
    </FormDialog>
  );
}
