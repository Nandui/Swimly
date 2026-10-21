import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { screenPage } from "@/lib/page-guards";
import { coinageDefaultSite, coinageSites, CoinageRequestForm } from "@/modules/coinage/features/request";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";

export const metadata: Metadata = { title: "New coinage request" };

export default async function NewCoinagePage() {
  await screenPage("coinage", "coinage.request");
  const sites = await coinageSites();
  return <PageShell header={<PageHeader title="Request coinage" description="Ask accounts for coins for a till. They check the request, order it and record the order here." />}>
    <CoinageRequestForm id={randomUUID()} sites={sites} defaultSite={await coinageDefaultSite(sites)} />
  </PageShell>;
}
