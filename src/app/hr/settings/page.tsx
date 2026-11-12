import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { pageSession } from "@/lib/page-guards";
import { requireFreshSession } from "@/lib/policy/session";
import { DigestSettings, digestSetting } from "@/modules/hr/features/digest";
import { hrAccess } from "@/modules/hr/features/workspace";

export const metadata: Metadata = { title: "HR settings" };

/** HR's own settings, for holders of "Keeps the daily reports email" (and
 *  superadmins), after a recent password; a 404 for everyone else. */
export default async function HrSettingsPage() {
  const who = hrAccess(await pageSession());
  if (!who?.digest) notFound();
  await requireFreshSession("hr.digest.manage", "/hr/settings");
  const digest = await digestSetting(who.orgId);
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Settings" description="How HR works for your organisation." />}>
      <DigestSettings {...digest} />
    </PageShell>
  );
}
