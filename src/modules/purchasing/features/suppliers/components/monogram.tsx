/** A supplier's initials in a tinted square, for its tile and its page: "Example Pool Chemicals" → "EP". */
export function SupplierMonogram({ name, size }: { name: string; size?: "lg" }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  return <span className="po-monogram" data-size={size} aria-hidden="true">{initials}</span>;
}
