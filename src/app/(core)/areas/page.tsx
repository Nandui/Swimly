import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { Tag } from "@/components/ui-kit/tag";
import { ArchiveArea, MoveArea, SaveArea } from "@/components/setup/areas";
import { screenPage } from "@/lib/page-guards";
import { areasPage } from "@/lib/setup/data";
import { ARCHIVAL_STATUS_META } from "@/lib/status";

export const metadata: Metadata = { title: "Areas" };

/** Each site's areas (Admin, Places; owner decision, 7 October 2026): the pools, gym and
 *  reception that Plan (test)'s sessions, the rota's activities and bookings and the swim school's
 *  classes and assessments pick from, in this order. One list for every app (owner, 2 November
 *  2026): an area is its name, what it is part of, its department and its lanes. The old Rota's
 *  hours, minimum staff and "covered from" settings are no longer edited here; what is saved stays
 *  for Rota. */
export default async function AreasPage() {
  await screenPage("areas", "setup.view");
  const { sites, canKeep } = await areasPage();
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Areas" description="Where work happens at each site, its parts and how many lanes a pool has. Plan (test), the rota, swim classes and short courses all pick from this one list, in this order, and can take a pool whole or by lane." />}>
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
</span>
                      <span className="pc-row-trail">
                        {area.archivedAt ? <Tag meta={ARCHIVAL_STATUS_META.archived} /> : null}
                        {canKeep ? <>
                          {!area.archivedAt ? <MoveArea id={area.id} name={area.name} first={at === 0} last={at === live.length - 1} /> : null}
                          <SaveArea siteId={site.id} siteName={site.name} departments={site.departments} parents={parents}
                            area={{ ...area, hasSubAreas: live.some((a) => a.parentId === area.id) }} />
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
