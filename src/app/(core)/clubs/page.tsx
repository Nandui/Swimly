import {
  ItemContent,
  ItemActions,
  Item,
  ItemGroup,
} from "@/components/shadcn/item";

import { CLUB_STATUS_META } from "@/lib/clubs/constants";
import { ARCHIVAL_STATUS_META } from "@/lib/status";
import type { Metadata } from "next";

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

export const metadata: Metadata = { title: "Clubs" };

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
        title="Clubs"
        description="Each site keeps its own programmes, classes and swimmers. Staff accounts and roles are shared between them."
        actions={<AddClub />}
      />

      <Lead>
        <Num>{live.length}</Num> {live.length === 1 ? "club" : "clubs"}. You are
        working in <Num>{current.name}</Num>; the site switcher in the Activities
        sidebar changes that, and every Activities page follows it.
      </Lead>

      {live.length === 0 ? (
        <EmptyState
          icon="building"
          title="No clubs"
          hint="Everything belongs to a club, so there has to be one."
          action={<AddClub />}
        />
      ) : (
        <ClubList clubs={live} currentId={current.id} summaries={summaries} />
      )}

      {archived.length > 0 ? (
        <section className="min-w-0 flex flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Archived</h2>
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
