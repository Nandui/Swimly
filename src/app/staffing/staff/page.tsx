import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { RecordSection } from "@/components/ui-kit/record";
import { Tag } from "@/components/ui-kit/tag";
import { type College, COLLEGE_META, CONTRACT_KIND_META, formatHours, RemoveStaff, StaffDialog, staffPage } from "@/modules/staffing/features/setup";

export const metadata: Metadata = { title: "Staff" };

/** Who is on the Staffing rota (part-time pool staff: swim teachers and lifeguards), from the
 *  people who work at a site. */
export default async function StaffingStaffPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const data = await staffPage((await searchParams).site);
  if (!data) return <PageShell header={<PageHeader title="Staff" />}><EmptyState title="No sites" /></PageShell>;
  const { site, staff } = data;
  if (!site.supervise) notFound();
  const onRota = staff.filter((s) => s.onRota);
  const rest = staff.filter((s) => !s.onRota);
  const row = (p: (typeof staff)[number]) => (
    <li key={p.id} className="pc-row">
      <span className="pc-row-body">
        <span className="pc-row-title">{p.name}</span>
        <span className="pc-row-hint">{p.contractMinutes !== null ? `${formatHours(p.contractMinutes)} a week contracted` : "No contracted hours on their Staff page"}{p.onRota && p.wantsMore ? " · wants extra hours" : ""}</span>
      </span>
      <span className="pc-row-trail">
        {p.onRota ? <><Tag meta={COLLEGE_META[p.college as College]} /><Tag meta={CONTRACT_KIND_META[p.contract]} /><RemoveStaff siteId={site.id} person={p} /></> : null}
        <StaffDialog siteId={site.id} person={p} />
      </span>
    </li>
  );
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Staff" description={`Everyone who works at ${site.name}. The part-time pool staff on the rota (swim teachers and lifeguards) are offered for places, with their contract and their college for exam seasons.`} />}>
      <RecordSection id="stf-staff-h" title="On the rota" aside={<p>{onRota.length}</p>}>
        {onRota.length === 0 ? <div className="pc-list"><EmptyState compact icon="users" title="Nobody on the rota yet" hint="Add swim teachers and lifeguards from the list below." /></div> : <ul className="pc-list">{onRota.map(row)}</ul>}
      </RecordSection>
      {rest.length ? <RecordSection id="stf-others-h" title="Everyone else here" aside={<p>{rest.length}</p>}><ul className="pc-list">{rest.map(row)}</ul></RecordSection> : null}
    </PageShell>
  );
}
