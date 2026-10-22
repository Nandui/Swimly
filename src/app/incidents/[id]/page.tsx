import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { Tag } from "@/components/ui-kit/tag";
import { FilesPanel } from "@/modules/incidents/features/files";
import { FootagePanel, footageOnReport } from "@/modules/incidents/features/footage";
import { WellbeingPanel, wellbeingOnReport } from "@/modules/incidents/features/wellbeing";
import { Investigation, ReopenReport } from "@/modules/incidents/features/investigation";
import { AddAddendum } from "@/modules/incidents/features/report";
import { incidentNumber, incidentReport, incidentStatuses, ReportView, seriousMeta } from "@/modules/incidents/features/reports";
import { CloseForm, TriageForm } from "@/modules/incidents/features/triage";

export const metadata: Metadata = { title: "Incident report" };

/** One report: as written, its triage, photos, CCTV footage, wellbeing checks and investigation, its history,
 *  and what this person may do next. */
export default async function IncidentPage({ params }: { params: Promise<{ id: string }> }) {
  const data = await incidentReport((await params).id);
  const { report: r, can } = data;
  const [footage, wellbeing] = await Promise.all([footageOnReport(r.id), wellbeingOnReport(r.id)]);
  return (
    <PageShell spacing="roomy" header={<PageHeader title={<span className="tabular-nums">{incidentNumber(r.number)}</span>} back={{ href: "/incidents", label: "Reports" }}
        status={<span className="flex flex-wrap gap-2">{r.serious ? <Tag meta={seriousMeta} /> : null}<Tag meta={incidentStatuses[r.status]} /></span>}
        description={`${r.site.name}${r.area ? `, ${r.area}` : ""}`}
        actions={<span className="flex flex-wrap gap-2">
          {can.export ? <Button asChild variant="outline" className="min-h-11"><Link href={`/incidents/${r.id}/export`}><FileText aria-hidden="true" />Full record</Link></Button> : null}
          {can.reopen ? <ReopenReport id={r.id} version={r.version} /> : null}<AddAddendum id={r.id} />
        </span>} />}>
      <ReportView data={data} forms={<>
        <FilesPanel reportId={r.id} files={r.files} userId={data.who.id} canAdd={can.addFiles} canRemoveAny={can.removeFiles} />
        {footage ? <FootagePanel reportId={r.id} data={footage} /> : null}
        {wellbeing ? <WellbeingPanel reportId={r.id} data={wellbeing} /> : null}
        {can.triage ? <TriageForm id={r.id} version={r.version} category={r.category} {...data.triage} /> : null}
        {can.seeInvestigation && r.status !== "reported" && (r.status === "investigating" || r.statements.length || r.actions.length || r.rootCause) ? (
          <Investigation id={r.id} version={r.version} today={data.today} occurredOn={r.occurredOn} statements={r.statements} whys={r.whys} rootCause={r.rootCause}
            actions={r.actions} owners={data.owners} canWork={can.investigate} needsRootCause={data.needsRootCause} />
        ) : null}
        {can.close ? <CloseForm id={r.id} version={r.version} hsaDue={r.hsaReportable ? r.hsaDueOn : null} openActions={data.openActions} missingRootCause={data.needsRootCause && r.rootCause.length < 3} /> : null}
      </>} />
    </PageShell>
  );
}
