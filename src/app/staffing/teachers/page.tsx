import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { RecordSection } from "@/components/ui-kit/record";
import { Tag } from "@/components/ui-kit/tag";
import { type College, COLLEGE_META, CONTRACT_KIND_META, formatHours, RemoveTeacher, TeacherDialog, teachersPage } from "@/modules/staffing/features/setup";

export const metadata: Metadata = { title: "Teachers" };

/** Who is a teacher in Staffing, from the people who work at a site. */
export default async function StaffingTeachersPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const data = await teachersPage((await searchParams).site);
  if (!data) return <PageShell header={<PageHeader title="Teachers" />}><EmptyState title="No sites" /></PageShell>;
  const { site, staff } = data;
  if (!site.supervise) notFound();
  const teachers = staff.filter((s) => s.teacher);
  const rest = staff.filter((s) => !s.teacher);
  const row = (p: (typeof staff)[number]) => (
    <li key={p.id} className="pc-row">
      <span className="pc-row-body">
        <span className="pc-row-title">{p.name}</span>
        <span className="pc-row-hint">{p.contractMinutes !== null ? `${formatHours(p.contractMinutes)} a week contracted` : "No contracted hours on their Staff page"}{p.teacher && p.wantsMore ? " · wants extra hours" : ""}</span>
      </span>
      <span className="pc-row-trail">
        {p.teacher ? <><Tag meta={COLLEGE_META[p.college as College]} /><Tag meta={CONTRACT_KIND_META[p.contract]} /><RemoveTeacher siteId={site.id} person={p} /></> : null}
        <TeacherDialog siteId={site.id} person={p} />
      </span>
    </li>
  );
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Teachers" description={`Everyone who works at ${site.name}. Teachers are offered for places, with their college for exam seasons and their contract type.`} />}>
      <RecordSection id="stf-teachers-h" title="Teachers" aside={<p>{teachers.length}</p>}>
        {teachers.length === 0 ? <div className="pc-list"><EmptyState compact icon="users" title="No teachers yet" hint="Make people teachers from the list below." /></div> : <ul className="pc-list">{teachers.map(row)}</ul>}
      </RecordSection>
      {rest.length ? <RecordSection id="stf-others-h" title="Everyone else here" aside={<p>{rest.length}</p>}><ul className="pc-list">{rest.map(row)}</ul></RecordSection> : null}
    </PageShell>
  );
}
