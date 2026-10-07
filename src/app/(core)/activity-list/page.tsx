import type { Metadata } from "next";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { ActivityDialog, ArchiveActivity } from "@/components/setup/activity-list";
import { screenPage } from "@/lib/page-guards";
import { activityListPage } from "@/lib/setup/data";
import { ACTIVITY_TAG_META, activityIcon } from "@/lib/setup/meta";
import { ARCHIVAL_STATUS_META } from "@/lib/status";

export const metadata: Metadata = { title: "Activities" };

/** The organisation's one list of activities (owner decisions, 6 and 7 October 2026): what the
 *  rota plans and covers, each with the department that plans it, its icon and the qualification
 *  it needs. Kept in Admin so every module uses the same list. */
export default async function ActivityListPage() {
  await screenPage("activity-list", "setup.view");
  const { types, departments, qualifications, canKeep } = await activityListPage();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Activities" description="What the rota plans and covers. Each activity belongs to the department that plans it, and may need a qualification."
        actions={canKeep && departments.length ? <ActivityDialog departments={departments} qualifications={qualifications} /> : undefined} />
      {types.length === 0 ? (
        <EmptyState icon="calendarDays" title="No activities yet" hint={departments.length ? "Add the kinds of work the rota plans, such as Lifeguarding, Teaching and Reception." : "Add departments first: every activity belongs to one."} />
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
                    {t.fromClasses ? <Tag meta={ACTIVITY_TAG_META.classes} /> : null}
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
    </div>
  );
}
