import type { Metadata } from "next";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { cctvFormData, ViewingForm } from "@/modules/cctv/features/viewings";

export const metadata: Metadata = { title: "Record a CCTV viewing" };

export default async function NewCctvViewingPage() {
  const { who, sites, today } = await cctvFormData();
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Record a CCTV viewing" back={{ href: "/cctv", label: "Viewings" }}
        description="Fill this in each time footage is checked, straight after. It shows the footage was looked at for a good reason." />}>
      <ViewingForm sites={sites} today={today} me={who.name} />
    </PageShell>
  );
}
