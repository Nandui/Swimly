import type { Metadata } from "next";
import Link from "next/link";
import { FilePlus2 } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { cctvViewings, ViewingPanel } from "@/modules/cctv/features/viewings";

export const metadata: Metadata = { title: "CCTV viewings" };

/** The log: your own viewings and, for those who review, everyone's at their sites. */
export default async function CctvViewingsPage() {
  const { who, rows } = await cctvViewings();
  const mine = rows.filter((r) => r.mine);
  const others = rows.filter((r) => !r.mine);
  return (
    <PageShell spacing="roomy" header={<PageHeader title="CCTV viewings"
        description="Every time CCTV footage is checked, write down who checked it, why, what they were looking for and what they saw."
        actions={<Button asChild className="min-h-11"><Link href="/cctv/new"><FilePlus2 aria-hidden="true" />Record a viewing</Link></Button>} />}>
      {who.review ? <ViewingPanel id="cctv-everyone" title={`Recorded by others · ${others.length}`} rows={others} empty={{ title: "Nobody else has recorded a viewing at your sites yet" }} /> : null}
      <ViewingPanel id="cctv-mine" title={`Recorded by you · ${mine.length}`} rows={mine}
        empty={{ title: "You have not recorded a viewing yet", hint: "Record one each time you check footage, even if nothing was seen." }} />
    </PageShell>
  );
}
