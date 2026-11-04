import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { RecordSection } from "@/components/ui-kit/record";
import { Tag } from "@/components/ui-kit/tag";
import { formatTimeRange } from "@/lib/format";
import { ARCHIVAL_STATUS_META } from "@/lib/status";
import { ArchiveSlot, RoleTag, SlotDialog, slotsPage } from "@/modules/staffing/features/setup";

export const metadata: Metadata = { title: "Slots" };

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** A site's weekly slots (spec section 4, SlotTemplate): the default template every block is
 *  built from. School bookings vary by week, so a block's places can be changed after. */
export default async function StaffingSlotsPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const data = await slotsPage((await searchParams).site);
  if (!data) return <PageShell header={<PageHeader title="Slots" />}><EmptyState title="No sites" /></PageShell>;
  const { site, slots } = data;
  if (!site.supervise) notFound();
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Slots" description={`Each week's places to fill at ${site.name}. New blocks take their places from here.`} actions={<SlotDialog siteId={site.id} />} />}>
      {slots.length === 0 ? <EmptyState icon="calendarRange" title="No slots yet" hint="Add the school mornings and afternoons, the programme lanes, the float and anything else that needs teachers." /> : null}
      {DAYS.map((label, i) => {
        const day = slots.filter((s) => s.weekday === i + 1);
        if (!day.length) return null;
        return (
          <RecordSection key={label} id={`stf-slots-${i}-h`} title={label} aside={<p>{day.filter((s) => !s.archived).reduce((n, s) => n + s.needed, 0)} people</p>}>
            <ul className="pc-list">
              {day.map((s) => (
                <li key={s.id} className="pc-row">
                  <span className="pc-row-body">
                    <span className="pc-row-title">{s.name}</span>
                    <span className="pc-row-hint">{formatTimeRange(s.startMin, s.endMin)} · {s.needed} needed{s.hardToFill ? " · hard to fill" : ""}</span>
                  </span>
                  <span className="pc-row-trail">
                    {s.archived ? <Tag meta={ARCHIVAL_STATUS_META.archived} /> : <RoleTag role={s.role} />}
                    <ArchiveSlot id={s.id} name={s.name} archived={s.archived} />
                    {s.archived ? null : <SlotDialog siteId={site.id} slot={s} />}
                  </span>
                </li>
              ))}
            </ul>
          </RecordSection>
        );
      })}
    </PageShell>
  );
}
