"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { ConfirmAction } from "@/components/confirm-action";
import { Field, FormDialog } from "@/components/form-dialog";
import { addApprovalRule, removeApprovalRule, saveProduct, saveSupplier, setProductArchived, setSupplierArchived } from "@/modules/purchasing/lib/actions";
import { toast } from "@/lib/toast";

const THEME = "turnfin-docs turnfin-module turnfin-purchasing";
type Supplier = { id: string; name: string; accountNumber: string; contactName: string; email: string; phone: string; note: string };
type Product = { id: string; name: string; code: string; unit: string; priceCents: number };
const value = (f: FormData, k: string) => String(f.get(k) ?? "");

/** Approve a supplier to order from, or change its details. */
export function SupplierDialog({ supplier }: { supplier?: Supplier }) {
  const id = supplier ? `sup-${supplier.id}` : "sup-new";
  return (
    <FormDialog
      portalClassName={THEME}
      width="sm:max-w-lg"
      trigger={supplier
        ? <Button variant="outline" className="min-h-11"><Pencil aria-hidden="true" />Change details</Button>
        : <Button className="min-h-11"><Plus aria-hidden="true" />Add supplier</Button>}
      title={supplier ? `Change ${supplier.name}` : "Approve a supplier"}
      description="Orders can only be raised with approved suppliers, for their approved products."
      submitLabel={supplier ? "Save" : "Add supplier"}
      successMessage={supplier ? "Supplier saved" : "Supplier added"}
      submit={(f) => saveSupplier(supplier?.id ?? null, { name: value(f, "name"), accountNumber: value(f, "accountNumber"), contactName: value(f, "contactName"), email: value(f, "email"), phone: value(f, "phone"), note: value(f, "note") })}
    >
      <Field label="Name" htmlFor={`${id}-name`}><Input id={`${id}-name`} name="name" required minLength={2} maxLength={100} defaultValue={supplier?.name} className="min-h-11" /></Field>
      <Field label="Our account number (optional)" htmlFor={`${id}-acc`} hint="Printed on every order."><Input id={`${id}-acc`} name="accountNumber" maxLength={60} defaultValue={supplier?.accountNumber} className="min-h-11" /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contact (optional)" htmlFor={`${id}-contact`}><Input id={`${id}-contact`} name="contactName" maxLength={100} defaultValue={supplier?.contactName} className="min-h-11" /></Field>
        <Field label="Phone (optional)" htmlFor={`${id}-phone`}><Input id={`${id}-phone`} name="phone" maxLength={40} defaultValue={supplier?.phone} className="min-h-11" /></Field>
      </div>
      <Field label="Orders email (optional)" htmlFor={`${id}-email`}><Input id={`${id}-email`} name="email" type="email" maxLength={200} defaultValue={supplier?.email} className="min-h-11" /></Field>
      <Field label="Note (optional)" htmlFor={`${id}-note`}><Input id={`${id}-note`} name="note" maxLength={500} defaultValue={supplier?.note} className="min-h-11" /></Field>
    </FormDialog>
  );
}

export function ArchiveSupplier({ id, name, archived }: { id: string; name: string; archived: boolean }) {
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={<Button variant="ghost" className="min-h-11">{archived ? <ArchiveRestore aria-hidden="true" /> : <Archive aria-hidden="true" />}{archived ? "Restore" : "Remove from approved"}</Button>}
      title={archived ? `Restore ${name}?` : `Remove ${name} from the approved suppliers?`}
      description={archived ? "Orders can be raised with it again." : "No new orders can be raised with it. Its orders stay in the record."}
      confirmLabel={archived ? "Restore" : "Remove"}
      successMessage={archived ? "Supplier restored" : "Supplier removed"}
      destructive={!archived}
      run={async () => { const r = await setSupplierArchived(id, !archived); if (r.ok) router.refresh(); return r; }}
    />
  );
}

/** Approve a product from this supplier at its agreed price, or change it. */
export function ProductDialog({ supplierId, product }: { supplierId: string; product?: Product }) {
  const id = product ? `prod-${product.id}` : "prod-new";
  return (
    <FormDialog
      portalClassName={THEME}
      trigger={product
        ? <Button variant="ghost" size="icon" className="size-11" aria-label={`Change ${product.name}`}><Pencil aria-hidden="true" /></Button>
        : <Button className="min-h-11"><Plus aria-hidden="true" />Add product</Button>}
      title={product ? `Change ${product.name}` : "Approve a product"}
      description="Orders use the agreed price at the time they are raised; changing it never changes past orders."
      submitLabel={product ? "Save" : "Add product"}
      successMessage={product ? "Product saved" : "Product added"}
      submit={(f) => saveProduct(supplierId, product?.id ?? null, { name: value(f, "name"), code: value(f, "code"), unit: value(f, "unit"), price: value(f, "price") })}
    >
      <Field label="Product" htmlFor={`${id}-name`}><Input id={`${id}-name`} name="name" required minLength={2} maxLength={120} defaultValue={product?.name} className="min-h-11" /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Supplier's code (optional)" htmlFor={`${id}-code`}><Input id={`${id}-code`} name="code" maxLength={60} defaultValue={product?.code} className="min-h-11" /></Field>
        <Field label="Unit (optional)" htmlFor={`${id}-unit`} hint="For example Box of 12."><Input id={`${id}-unit`} name="unit" maxLength={60} defaultValue={product?.unit} className="min-h-11" /></Field>
      </div>
      <Field label="Agreed price per unit, before VAT (€)" htmlFor={`${id}-price`}><Input id={`${id}-price`} name="price" required inputMode="decimal" defaultValue={product ? (product.priceCents / 100).toFixed(2) : ""} placeholder="12.50" className="min-h-11 w-40 tabular-nums" /></Field>
    </FormDialog>
  );
}

export function ArchiveProduct({ id, name, archived }: { id: string; name: string; archived: boolean }) {
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={<Button variant="ghost" size="icon" className="size-11" aria-label={archived ? `Restore ${name}` : `Remove ${name}`}>{archived ? <ArchiveRestore aria-hidden="true" /> : <Archive aria-hidden="true" />}</Button>}
      title={archived ? `Restore ${name}?` : `Remove ${name} from the approved products?`}
      description={archived ? "It can be ordered again." : "It can no longer be ordered. Past orders keep it."}
      confirmLabel={archived ? "Restore" : "Remove"}
      successMessage={archived ? "Product restored" : "Product removed"}
      destructive={!archived}
      run={async () => { const r = await setProductArchived(id, !archived); if (r.ok) router.refresh(); return r; }}
    />
  );
}

/** Add who may approve: a role, up to an amount (empty for any amount). */
export function AddRule({ supplierId, roles }: { supplierId: string | null; roles: { id: string; name: string }[] }) {
  const router = useRouter();
  const [roleId, setRoleId] = useState("");
  const [limit, setLimit] = useState("");
  const [pending, start] = useTransition();
  const id = supplierId ?? "all";
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        const r = await addApprovalRule({ supplierId, roleId, limit });
        if (!r.ok) { toast.error(r.error); return; }
        toast.success("Approver added");
        setRoleId(""); setLimit("");
        router.refresh();
      });
    }}>
      <div className="min-w-48 flex-1 space-y-1.5">
        <Label htmlFor={`rule-role-${id}`}>Role</Label>
        <NativeSelect id={`rule-role-${id}`} value={roleId} onChange={(e) => setRoleId(e.target.value)} required>
          <NativeSelectOption value="" disabled>Choose a role</NativeSelectOption>
          {roles.map((r) => <NativeSelectOption key={r.id} value={r.id}>{r.name}</NativeSelectOption>)}
        </NativeSelect>
      </div>
      <div className="w-40 space-y-1.5">
        <Label htmlFor={`rule-limit-${id}`}>Up to (€)</Label>
        <Input id={`rule-limit-${id}`} value={limit} onChange={(e) => setLimit(e.target.value)} inputMode="decimal" placeholder="No limit" className="tabular-nums" />
      </div>
      <Button type="submit" variant="outline" disabled={pending || !roleId}><Plus aria-hidden="true" />Add approver</Button>
    </form>
  );
}

export function RemoveRule({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={<Button variant="ghost" size="icon" className="size-11" aria-label={`Remove ${label}`}><Trash2 aria-hidden="true" /></Button>}
      title={`Remove ${label}?`}
      description="Orders waiting for approval stay waiting; someone else with a rule that covers them can still approve."
      confirmLabel="Remove"
      successMessage="Approver removed"
      destructive
      run={async () => { const r = await removeApprovalRule(id); if (r.ok) router.refresh(); return r; }}
    />
  );
}
