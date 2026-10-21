import { Avatar, AvatarFallback, AvatarImage } from "@/components/shadcn/avatar";

/** Where a supplier's picture is served; the version changes with each new picture. */
export function supplierPictureUrl(id: string, version?: string | null) {
  return version ? `/purchasing/suppliers/${encodeURIComponent(id)}/picture?v=${encodeURIComponent(version)}` : undefined;
}

/** A supplier's picture (its logo or a photo) in a rounded square, for its tile, its
 *  page, the new order and the order; its initials until it has one ("Example Pool
 *  Chemicals" → "EP"), and while the picture loads. Its name always shows beside it. */
export function SupplierPicture({ id, name, version, size }: { id: string; name: string; version?: string | null; size?: "lg" }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  const src = supplierPictureUrl(id, version);
  return (
    <Avatar size={size ?? "default"} className="po-monogram" aria-hidden="true">
      {src ? <AvatarImage src={src} alt="" className="po-picture" /> : null}
      <AvatarFallback className="po-initials">{initials}</AvatarFallback>
    </Avatar>
  );
}
