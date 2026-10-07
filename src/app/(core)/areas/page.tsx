import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { ArchiveArea, MoveArea, SaveArea } from "@/components/setup/areas";
import { screenPage } from "@/lib/page-guards";
import { areasPage } from "@/lib/setup/data";
import { ARCHIVAL_STATUS_META } from "@/lib/status";

export const metadata: Metadata = { title: "Areas" };

/** Each site's areas (Admin, Places; owner decision, 7 October 2026): the pools, gym and
 *  reception that the rota's activities and bookings and the swim school's classes and
 *  assessments pick from, in this order. */
export default async function AreasPage() {
  await screenPage("areas", "setup.view");
  const { sites, canKeep } = await areasPage();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Areas" description="Where work happens at each site. The rota, bookings and swim classes pick from these, in this order." />
      {sites.length === 0 ? <EmptyState icon="building" title="No open sites" hint="Add a site under Sites first." /> : sites.map((site) => {
        const live = site.areas.filter((a) => !a.archivedAt);
        return (
          <section key={site.id} className="pc-panel" aria-labelledby={`areas-${site.id}`}>
            <div className="pc-panel-head">
              <h2 id={`areas-${site.id}`}>{site.name}{site.code ? <span className="font-normal text-ui-muted-foreground"> · {site.code}</span> : null}</h2>
              {canKeep ? <SaveArea siteId={site.id} siteName={site.name} /> : null}
            </div>
            {site.areas.length === 0 ? (
              <EmptyState compact icon="building" title="No areas yet" hint="Add its pools, gym, reception and any other place work is planned." />
            ) : (
              <ul className="pc-rows">
                {site.areas.map((area) => {
                  const at = live.findIndex((a) => a.id === area.id);
                  return (
                    <li key={area.id} className="pc-row" {...(area.archivedAt ? { "data-muted": "" } : {})}>
                      <span className="pc-tile-icon" aria-hidden="true"><MapPin /></span>
                      <span className="pc-row-body"><span className="pc-row-title">{area.name}</span></span>
                      <span className="pc-row-trail">
                        {area.archivedAt ? <Tag meta={ARCHIVAL_STATUS_META.archived} /> : null}
                        {canKeep ? <>
                          {!area.archivedAt ? <MoveArea id={area.id} name={area.name} first={at === 0} last={at === live.length - 1} /> : null}
                          <SaveArea siteId={site.id} siteName={site.name} area={area} />
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
    </div>
  );
}
