import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { Tag } from "@/components/ui-kit/tag";
import { ArchiveArea, AreaStaffing, MoveArea, SaveArea } from "@/components/setup/areas";
import { lineLabel, staffingWords } from "@/lib/setup/area-staffing";
import { screenPage } from "@/lib/page-guards";
import { areasPage } from "@/lib/setup/data";
import { ARCHIVAL_STATUS_META } from "@/lib/status";

export const metadata: Metadata = { title: "Areas" };

/** Each site's areas (Admin, Places; owner decision, 7 October 2026): the pools, gym and
 *  reception that the rota's activities and bookings and the swim school's classes and
 *  assessments pick from, in this order. */
export default async function AreasPage() {
  await screenPage("areas", "setup.view");
  const { sites, canKeep, qualifications, roles, activities } = await areasPage();
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Areas" description="Where work happens at each site, how many lanes a pool has, and the staff each needs while it is open. The rota, bookings, swim classes and short courses pick from these, in this order, and can take a pool whole or by lane." />}>
      {sites.length === 0 ? <EmptyState icon="building" title="No open sites" hint="Add a site under Sites first." /> : sites.map((site) => {
        const live = site.areas.filter((a) => !a.archivedAt);
        const parents = live.filter((a) => !a.parentId).map((a) => ({ id: a.id, name: a.name }));
        const departmentName = (id: string | null) => site.departments.find((d) => d.id === id)?.name ?? null;
        return (
          <section key={site.id} className="flex min-w-0 flex-col" aria-labelledby={`areas-${site.id}`}>
            <div className="pc-section-head">
              <h2 id={`areas-${site.id}`}>{site.name}{site.code ? <span className="font-normal text-ui-muted-foreground"> · {site.code}</span> : null}</h2>
              {canKeep ? <SaveArea siteId={site.id} siteName={site.name} departments={site.departments} parents={parents} /> : null}
            </div>
            {site.areas.length === 0 ? (
              <EmptyState compact icon="building" title="No areas yet" hint="Add its pools, gym, reception and any other place work is planned." />
            ) : (
              <ul className="pc-list">
                {site.areas.map((area) => {
                  const at = live.findIndex((a) => a.id === area.id);
                  const parent = area.parentId ? site.areas.find((a) => a.id === area.parentId) ?? null : null;
                  const home = parent ? `Part of ${parent.name}${departmentName(parent.departmentId) ? `, ${departmentName(parent.departmentId)}` : ""}` : departmentName(area.departmentId);
                  return (
                    <li key={area.id} className={parent ? "pc-row pl-10" : "pc-row"} {...(area.archivedAt ? { "data-muted": "" } : {})}>
                      <span className="pc-tile-icon" aria-hidden="true"><MapPin /></span>
                      <span className="pc-row-body"><span className="pc-row-title">{area.name}</span>
                        {home ? <span className="pc-row-hint">{home}</span> : null}
                        {area.lanes ? <span className="pc-row-hint">{area.lanes === 1 ? "Lane 1" : `Lanes 1 to ${area.lanes}`}, booked whole or by lane</span>
                          : /pool/i.test(area.name) ? <span className="pc-row-hint">No lanes yet. Change it to give the pool its lanes.</span> : null}
                        {staffingWords(area) ? <span className="pc-row-hint">{staffingWords(area)}</span> : null}
                        {area.together.map((t) => {
                          const other = site.areas.find((a) => a.id === t.withAreaId);
                          const type = lineLabel(area.minimums, t.typeId) ?? "anyone";
                          return other ? <span key={`${t.withAreaId}-${t.typeId ?? ""}`} className="pc-row-hint">Covered from {other.name} while both are open: {t.count} {type} in all</span> : null;
                        })}</span>
                      <span className="pc-row-trail">
                        {area.archivedAt ? <Tag meta={ARCHIVAL_STATUS_META.archived} /> : null}
                        {canKeep ? <>
                          {!area.archivedAt ? <MoveArea id={area.id} name={area.name} first={at === 0} last={at === live.length - 1} /> : null}
                          <SaveArea siteId={site.id} siteName={site.name} departments={site.departments} parents={parents}
                            area={{ ...area, hasSubAreas: live.some((a) => a.parentId === area.id) }} />
                          {!area.archivedAt ? <AreaStaffing area={area} qualifications={qualifications} activities={activities} roles={roles} others={live.filter((a) => a.id !== area.id)} /> : null}
                          <ArchiveArea id={area.id} name={area.name} archived={!!area.archivedAt} />
                        </> : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </PageShell>
  );
}
