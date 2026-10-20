import type { Metadata } from "next";
import Link from "next/link";
import { FilePlus2 } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { yourActions, YourActionsPanel } from "@/modules/incidents/features/investigation";
import { incidentLists, ReportPanel } from "@/modules/incidents/features/reports";

export const metadata: Metadata = { title: "Incident reports" };

/** The reports: the actions you own; for those who triage, what waits and
 *  what is open at their sites; for everyone, their own reports. */
export default async function IncidentsPage() {
  const [{ who, toTriage, investigating, mine, closed }, actions] = await Promise.all([incidentLists(), yourActions()]);
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Incident reports"
        description={who.review ? "Reports at the sites you cover, from triage to closed, and your own." : "The reports you made, and what happened next."}
        actions={<Button asChild className="min-h-11"><Link href="/incidents/new"><FilePlus2 aria-hidden="true" />Report an incident</Link></Button>} />}>
      {actions.rows.length ? <YourActionsPanel data={actions} /> : null}
      {who.review ? <>
        <ReportPanel id="to-triage" title={`To triage · ${toTriage.length}`} rows={toTriage} empty={{ title: "Nothing waiting for triage" }} />
        <ReportPanel id="investigating" title={`Under investigation · ${investigating.length}`} rows={investigating} empty={{ title: "Nothing under investigation" }} />
      </> : null}
      <ReportPanel id="mine" title="Your reports" rows={mine} empty={{ title: "You have not reported anything yet", hint: "Near misses count too. Report an incident takes two minutes." }} />
      {who.review ? <ReportPanel id="closed" title="Recently closed" rows={closed} empty={{ title: "Nothing closed yet" }} /> : null}
    </PageShell>
  );
}
