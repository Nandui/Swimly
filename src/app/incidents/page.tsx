import type { Metadata } from "next";
import Link from "next/link";
import { FilePlus2 } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { SegmentedLinks } from "@/components/ui-kit/segmented-links";
import { yourActions, YourActionsPanel } from "@/modules/incidents/features/investigation";
import { incidentLists, ReportPanel } from "@/modules/incidents/features/reports";

export const metadata: Metadata = { title: "Incidents" };

const VIEWS = ["triage", "investigating", "mine", "closed"] as const;
type View = (typeof VIEWS)[number];

/** The reports, as the approved Turnfin Glass canvas draws them: the actions you own first; for
 *  those who triage, one list at a time behind a filter with counts (to triage, investigating,
 *  yours, recently closed), opening on what waits for triage; for everyone else, their own
 *  reports. */
export default async function IncidentsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const [{ who, toTriage, investigating, mine, closed }, actions, { show }] = await Promise.all([incidentLists(), yourActions(), searchParams]);
  const view: View = who.review ? (VIEWS.includes(show as View) ? show as View : "triage") : "mine";
  const lists = {
    triage: { label: "To triage", rows: toTriage, empty: { title: "Nothing waiting for triage" } },
    investigating: { label: "Investigating", rows: investigating, empty: { title: "Nothing under investigation" } },
    mine: { label: "Yours", rows: mine, empty: { title: "You have not reported anything yet", hint: "Near misses count too. Report an incident takes two minutes." } },
    closed: { label: "Closed", rows: closed, empty: { title: "Nothing closed yet" } },
  } satisfies Record<View, unknown>;
  const list = lists[view];
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Incidents"
        description={who.review ? "Accidents, incidents and near misses at the sites you cover, and your own reports." : "The reports you made, and what happened next."}
        actions={<Button asChild><Link href="/incidents/new"><FilePlus2 aria-hidden="true" />Report an incident</Link></Button>} />}>
      {actions.rows.length ? <YourActionsPanel data={actions} /> : null}
      {who.review ? (
        <SegmentedLinks label="Show reports" className="self-start"
          items={VIEWS.map((v) => ({ href: `/incidents?show=${v}`, label: lists[v].label, count: lists[v].rows.length, current: v === view }))} />
      ) : null}
      <ReportPanel id={view} title={view === "mine" ? "Your reports" : view === "closed" ? "Recently closed" : list.label} rows={list.rows} empty={list.empty} />
    </PageShell>
  );
}
