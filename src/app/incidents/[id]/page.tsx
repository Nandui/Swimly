import type { Metadata } from "next";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { AddAddendum } from "@/modules/incidents/features/report";
import { incidentNumber, incidentReport, incidentStatuses, ReportView, seriousMeta } from "@/modules/incidents/features/reports";
import { CloseForm, TriageForm } from "@/modules/incidents/features/triage";

export const metadata: Metadata = { title: "Incident report" };

/** One report: as written, its triage and history, and what this person may do next. */
export default async function IncidentPage({ params }: { params: Promise<{ id: string }> }) {
  const data = await incidentReport((await params).id);
  const { report: r, can } = data;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={<span className="tabular-nums">{incidentNumber(r.number)}</span>} back={{ href: "/incidents", label: "Reports" }}
        status={<span className="flex flex-wrap gap-2">{r.serious ? <Tag meta={seriousMeta} /> : null}<Tag meta={incidentStatuses[r.status]} /></span>}
        description={`${r.site.name}${r.area ? `, ${r.area}` : ""}`}
        actions={<AddAddendum id={r.id} />} />
      <ReportView data={data} forms={<>
        {can.triage ? <TriageForm id={r.id} version={r.version} hasChild={data.hasChild} /> : null}
        {can.close ? <CloseForm id={r.id} version={r.version} hsaDue={r.hsaReportable ? r.hsaDueOn : null} /> : null}
      </>} />
    </div>
  );
}
