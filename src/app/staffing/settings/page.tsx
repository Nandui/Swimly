import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { RecordFacts, RecordSection } from "@/components/ui-kit/record";
import { formatShortDay } from "@/lib/format";
import { NUMBERS, SettingsDialog, settingsPage, TIMES } from "@/modules/staffing/features/setup";

export const metadata: Metadata = { title: "Staffing settings" };

/** Every number Staffing's rules use (spec section 10), for the whole organisation. */
export default async function StaffingSettingsPage() {
  const { who, settings, types } = await settingsPage();
  if (!who.manage) notFound();
  const typeName = (id: string | null) => (id ? types.find((t) => t.id === id)?.name ?? "A type no longer listed" : "Not checked");
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Settings" description="The numbers Staffing's rules use. Warnings never refuse; these decide when they show." actions={<SettingsDialog settings={settings} types={types} />} />}>
      <RecordSection id="stf-set-times-h" title="Deadlines">
        <RecordFacts items={[...TIMES.map(([k, label]) => [label, settings[k]] as [string, string]), ["Strikes count from", formatShortDay(settings.strikeCountingFrom)]]} />
      </RecordSection>
      <RecordSection id="stf-set-numbers-h" title="Numbers">
        <RecordFacts items={NUMBERS.map(([k, label]) => [label, String(settings[k])] as [string, string])} />
      </RecordSection>
      <RecordSection id="stf-set-quals-h" title="Qualifications checked">
        <RecordFacts items={[["Swim teacher", typeName(settings.teachingTypeId)], ["Lifeguard", typeName(settings.lifeguardTypeId)], ["Garda vetting", typeName(settings.vettingTypeId)]]} />
      </RecordSection>
    </PageShell>
  );
}
