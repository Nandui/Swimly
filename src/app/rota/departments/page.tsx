import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2 } from "lucide-react";
import { DepartmentRows } from "@/components/rota/roster-import";
import { requireRotaActor } from "@/lib/rota/access";
import { rotaDepartments } from "@/lib/rota/data";

export const metadata: Metadata = { title: "Departments" };

/** Where each roster department code works, and what the rota calls it.
 *  New codes are asked for during an upload; they can be changed here. */
export default async function RotaDepartmentsPage() {
  const who = await requireRotaActor();
  if (!who.manage) notFound();
  const { sites, departments } = await rotaDepartments();
  const initial = Object.fromEntries(departments.map((d) => [d.code, { siteId: d.siteId, label: d.label }]));
  return (
    <div className="space-y-6">
      <div className="module-heading">
        <div className="space-y-2">
          <h1>Departments</h1>
          <p className="text-sm">The roster&apos;s department codes: the site each one works at and the name the rota shows. Changing one moves its imported shifts with it.</p>
        </div>
      </div>
      {departments.length === 0 ? (
        <div className="module-empty"><Building2 aria-hidden="true" /><h2 className="font-semibold">No departments yet</h2><p className="mt-2 text-sm text-ui-muted-foreground">They appear with the first <Link href="/rota/import" className="underline underline-offset-2">roster upload</Link>.</p></div>
      ) : (
        <section className="module-panel" aria-label="Departments">
          <DepartmentRows codes={departments.map((d) => d.code)} sites={sites.map(({ id, name }) => ({ id, name }))} initial={initial} />
        </section>
      )}
    </div>
  );
}
