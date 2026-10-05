import { Building2 } from "lucide-react";

import { CLUB_STATUS_META } from "@/lib/clubs/constants";
import { ARCHIVAL_STATUS_META } from "@/lib/status";
import type { Metadata } from "next";
import { plural } from "@/lib/format";

import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import {
  AddClub,
  ArchiveClub,
  EditClub,
} from "@/components/clubs/club-actions";
import { getCurrentClub } from "@/lib/clubs/current";
import { getClubs, type ClubRow } from "@/lib/clubs/data/clubs";
import { siteSummaryLines } from "@/modules/server";
import { screenPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Sites" };

export default async function ClubsPage() {
  await screenPage("clubs", "clubs.manage");

  const [clubs, { club: current }] = await Promise.all([
    getClubs(),
    getCurrentClub(),
  ]);
  // What each site runs comes from the modules (Activities: programmes, swimmers, classes).
  const summaries = await siteSummaryLines(clubs.map((club) => club.id));
  const live = clubs.filter((club) => !club.archivedAt);
  const archived = clubs.filter((club) => club.archivedAt);

  return (
    <div className="min-w-0 flex flex-col gap-4">
      <PageHeader
        title="Sites"
        description="Your sites. Swimmers, programmes and staff are shared; each site keeps its own timetable."
        actions={<AddClub />}
      />

      {live.length === 0 ? (
        <EmptyState
          icon="building"
          title="No sites"
          hint="Everything belongs to a site, so there has to be one."
          action={<AddClub />}
        />
      ) : (
        <section className="pc-panel" aria-label="Sites">
          <p className="text-sm text-ui-muted-foreground">
            {plural(live.length, "site")}. You are working at {current.name}; the site picker on Home and in Swim school changes that.
          </p>
          <ClubList clubs={live} currentId={current.id} summaries={summaries} />
        </section>
      )}

      {archived.length > 0 ? (
        <section className="pc-panel" aria-labelledby="sites-archived">
          <div className="pc-panel-head">
            <h2 id="sites-archived" className="text-lg font-semibold">Archived</h2>
          </div>
          <p className="text-sm text-ui-muted-foreground">
            Not in the site picker. Everything recorded under them is still there.
          </p>
          <ClubList clubs={archived} currentId={current.id} summaries={summaries} archived />
        </section>
      ) : null}
    </div>
  );
}

function ClubList({
  clubs,
  currentId,
  summaries,
  archived,
}: {
  clubs: ClubRow[];
  currentId: string;
  summaries: Map<string, string>;
  archived?: boolean;
}) {
  return (
    <ul className="pc-rows">
      {clubs.map((club) => (
        <li key={club.id} className="pc-row [overflow-wrap:anywhere]">
          <span className="pc-tile-icon" aria-hidden="true"><Building2 /></span>
          <div className="pc-row-body">
            <span className="pc-row-title">{club.name}</span>
            {summaries.get(club.id) ? <span className="pc-row-hint">{summaries.get(club.id)}</span> : null}
          </div>
          <div className="pc-row-trail">
            {club.id === currentId ? <Tag meta={CLUB_STATUS_META.current} /> : null}
            {archived ? <Tag meta={ARCHIVAL_STATUS_META.archived} /> : null}
            <div className="flex flex-nowrap gap-2">
              <EditClub club={club} />
              <ArchiveClub club={club} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
