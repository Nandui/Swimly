import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { AddClub, ArchiveClub, EditClub } from "@/components/clubs/club-actions";
import { getCurrentClub } from "@/lib/clubs/current";
import { getClubs, type ClubRow } from "@/lib/clubs/data/clubs";
import { screenPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Clubs" };

export default async function ClubsPage() {
  await screenPage("clubs", "clubs.manage");

  const [clubs, { club: current }] = await Promise.all([getClubs(), getCurrentClub()]);
  const live = clubs.filter((club) => !club.archivedAt);
  const archived = clubs.filter((club) => club.archivedAt);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clubs"
        description="Each site keeps its own programmes, classes and swimmers. Staff accounts and roles are shared between them."
        actions={<AddClub />}
      />

      <p className="max-w-prose text-sm text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">{live.length}</span>{" "}
        {live.length === 1 ? "club" : "clubs"}. You are working in{" "}
        <span className="font-medium text-foreground">{current.name}</span>; the switcher at the
        top of the sidebar changes that, and every page follows it.
      </p>

      {live.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No clubs"
          hint="Everything belongs to a club, so there has to be one."
          action={<AddClub />}
        />
      ) : (
        <ClubList clubs={live} currentId={current.id} />
      )}

      {archived.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Archived</h2>
          <p className="max-w-prose text-sm text-muted-foreground">
            Not in the switcher. Everything recorded under them is still there.
          </p>
          <ClubList clubs={archived} currentId={current.id} archived />
        </section>
      ) : null}
    </div>
  );
}

function ClubList({
  clubs,
  currentId,
  archived,
}: {
  clubs: ClubRow[];
  currentId: string;
  archived?: boolean;
}) {
  return (
    <ul className="overflow-hidden rounded-md border">
      {clubs.map((club) => (
        <li
          key={club.id}
          className="group flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b px-3 py-2 transition-colors last:border-0 hover:bg-accent/40"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              {club.name}
              {club.id === currentId ? (
                <Tag color="blue" className="ml-2">
                  Working in
                </Tag>
              ) : null}
              {archived ? (
                <Tag color="gray" className="ml-2">
                  Archived
                </Tag>
              ) : null}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              <span className="tabular-nums">{club._count.programmes}</span>{" "}
              {club._count.programmes === 1 ? "programme" : "programmes"} ·{" "}
              <span className="tabular-nums">{club._count.students}</span> active{" "}
              {club._count.students === 1 ? "swimmer" : "swimmers"} ·{" "}
              <span className="tabular-nums">{club._count.courses}</span>{" "}
              {club._count.courses === 1 ? "class" : "classes"}
            </p>
          </div>
          <div className="flex items-center gap-0.5 max-md:gap-2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100">
            <EditClub club={club} />
            <ArchiveClub club={club} />
          </div>
        </li>
      ))}
    </ul>
  );
}
