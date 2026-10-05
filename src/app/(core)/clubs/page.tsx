import {
  ItemContent,
  ItemActions,
  Item,
  ItemGroup,
} from "@/components/shadcn/item";

import { CLUB_STATUS_META } from "@/lib/clubs/constants";
import { ARCHIVAL_STATUS_META } from "@/lib/status";
import type { Metadata } from "next";
import { plural } from "@/lib/format";

import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Lead, Num } from "@/components/ui-kit/prose";
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
    <div className="min-w-0 flex flex-col gap-6">
      <PageHeader
        title="Sites"
        description="Each site keeps its own programmes, classes and swimmers. Staff accounts and roles are shared between them."
        actions={<AddClub />}
      />

      <Lead>
        <Num>{plural(live.length, "site")}</Num>. You are working in{" "}
        <Num>{current.name}</Num>; the site picker in the top bar changes that,
        and every swim school page follows it.
      </Lead>

      {live.length === 0 ? (
        <EmptyState
          icon="building"
          title="No sites yet"
          hint="Everything belongs to a site, so there has to be one."
          action={<AddClub />}
        />
      ) : (
        <ClubList clubs={live} currentId={current.id} summaries={summaries} />
      )}

      {archived.length > 0 ? (
        <section className="pc-panel">
          <h2 className="text-lg font-semibold">Archived</h2>
          <Lead>
            Not in the switcher. Everything recorded under them is still there.
          </Lead>
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
    <ItemGroup className="divide-y divide-ui-border">
      {clubs.map((club) => (
        <Item
          key={club.id}
          role="listitem"
          className="items-start [overflow-wrap:anywhere]"
        >
          <ItemContent className="min-w-0">
            <div className="text-sm font-medium">
              {
                <div className="min-w-0 flex gap-2 items-center flex-wrap">
                  <span className="text-sm text-ui-foreground font-medium">
                    {club.name}
                  </span>
                  {club.id === currentId ? (
                    <Tag color={CLUB_STATUS_META.current.color}>
                      {CLUB_STATUS_META.current.label}
                    </Tag>
                  ) : null}
                  {archived ? (
                    <Tag color={ARCHIVAL_STATUS_META.archived.color}>
                      {ARCHIVAL_STATUS_META.archived.label}
                    </Tag>
                  ) : null}
                </div>
              }
            </div>
            {summaries.get(club.id) ? <div className="text-sm text-ui-muted-foreground">{summaries.get(club.id)}</div> : null}
          </ItemContent>
          <ItemActions className="flex-wrap">
            {
              <div className="min-w-0 flex gap-1 items-center">
                <EditClub club={club} />
                <ArchiveClub club={club} />
              </div>
            }
          </ItemActions>
        </Item>
      ))}
    </ItemGroup>
  );
}
