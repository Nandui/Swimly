import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { incidentsAccess } from "@/modules/incidents/features/workspace";
import { WellbeingSettings, wellbeingSetting } from "@/modules/incidents/features/wellbeing";
import { pageSession } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Incidents settings" };

/** Incidents' own settings, for Manage; a 404 for everyone else. Admin lists it under Modules. */
export default async function IncidentsSettingsPage() {
  const who = incidentsAccess(await pageSession());
  if (!who?.signoff) notFound();
  const wellbeing = await wellbeingSetting(who.orgId);
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Settings" description="How Incidents works for everyone at your sites." />}>
      <WellbeingSettings {...wellbeing} />
    </PageShell>
  );
}
