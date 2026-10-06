import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { ActivityDialog, ArchiveActivity } from "@/components/rota/activity-list";
import { ARCHIVAL_STATUS_META } from "@/lib/status";
import { activityList } from "@/lib/rota/data";
import { ROTA_CLASS_META, activityIcon } from "@/lib/rota/meta";

export const metadata: Metadata = { title: "Activity list" };

/** The organisation's one list of activities (owner decision, 6 October 2026): what the rota
 *  plans, each with the department that plans it, its icon and the qualification it needs. Kept by
 *  people who run the rota everywhere; others who run it see it. */
export default async function ActivityListPage() {
  const data = await activityList();
  if (!data.who.run) notFound();
  const { types, departments, qualifications, canKeep } = data;
  return (
    <>
      <PageHeader title="Activity list" description="What the rota plans. Each activity belongs to the department that plans it, and may need a qualification."
        actions={canKeep && departments.length ? <ActivityDialog departments={departments} qualifications={qualifications} /> : undefined} />
      {!canKeep ? <p className="text-sm text-ui-muted-foreground">The list is the organisation&apos;s, so it is kept by people who run the rota at every site.</p> : null}
      {types.length === 0 ? (
        <EmptyState icon="calendarDays" title="No activities yet" hint={departments.length ? "Add the kinds of work the rota plans, such as Lifeguarding, Teaching and Reception." : "Add departments under Admin first: every activity belongs to one."} />
      ) : (
        <section aria-label="Activities" className="pc-panel">
          <ul className="pc-rows">
            {types.map((t) => {
              const Icon = activityIcon(t.icon);
              return (
                <li key={t.id} className="pc-row" {...(t.archived ? { "data-muted": "" } : {})}>
                  <span className="pc-tile-icon" aria-hidden="true"><Icon /></span>
                  <span className="pc-row-body">
                    <span className="pc-row-title">{t.name}</span>
                    <span className="pc-row-hint">{t.departmentName}{t.requiredName ? ` · needs ${t.requiredName}` : ""}</span>
                  </span>
                  <span className="pc-row-trail">
                    {t.fromClasses ? <Tag meta={ROTA_CLASS_META.usual} label="Takes the swim classes" /> : null}
                    {t.archived ? <Tag meta={ARCHIVAL_STATUS_META.archived} /> : null}
                    {canKeep ? <>
                      <ActivityDialog activity={t} departments={departments} qualifications={qualifications} />
                      <ArchiveActivity id={t.id} name={t.name} archived={t.archived} />
                    </> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
