import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RosterImport } from "@/components/rota/roster-import";
import { requireRotaActor } from "@/lib/rota/access";

export const metadata: Metadata = { title: "Upload roster" };

/** Rota managers upload the week's roster from the payroll system. */
export default async function RotaImportPage() {
  const who = await requireRotaActor();
  if (!who.manage) notFound();
  return (
    <div className="space-y-6">
      <div className="module-heading">
        <div className="space-y-2">
          <h1>Upload roster</h1>
          <p className="text-sm">Bring in the week for both sites. Everyone on it shows on the rota by name, login or not, and a new upload of the same week is logged under Changes.</p>
        </div>
      </div>
      <RosterImport />
    </div>
  );
}
