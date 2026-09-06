import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { Item } from "@astryxdesign/core/Item";
import { List } from "@astryxdesign/core/List";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Heading, Text } from "@astryxdesign/core/Text";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Lead, Num } from "@/components/ui-kit/prose";
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
    <VStack gap={6}>
      <PageHeader
        title="Clubs"
        description="Each site keeps its own programmes, classes and swimmers. Staff accounts and roles are shared between them."
        actions={<AddClub />}
      />

      <Lead>
        <Num>{live.length}</Num> {live.length === 1 ? "club" : "clubs"}. You are working in{" "}
        <Num>{current.name}</Num>; the switcher at the top of the sidebar changes that, and every
        page follows it.
      </Lead>

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
        <VStack gap={3} as="section">
          <Heading level={2}>Archived</Heading>
          <Lead>Not in the switcher. Everything recorded under them is still there.</Lead>
          <ClubList clubs={archived} currentId={current.id} archived />
        </VStack>
      ) : null}
    </VStack>
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
    <List hasDividers>
      {clubs.map((club) => (
        <Item
          key={club.id}
          as="li"
          align="start"
          label={
            <HStack gap={2} vAlign="center" wrap="wrap">
              <Text weight="medium">{club.name}</Text>
              {club.id === currentId ? <Tag color="blue">Working in</Tag> : null}
              {archived ? <Tag color="gray">Archived</Tag> : null}
            </HStack>
          }
          description={`${club._count.programmes} ${club._count.programmes === 1 ? "programme" : "programmes"} · ${club._count.students} active ${club._count.students === 1 ? "swimmer" : "swimmers"} · ${club._count.courses} ${club._count.courses === 1 ? "class" : "classes"}`}
          endContent={
            <HStack gap={1} vAlign="center">
              <EditClub club={club} />
              <ArchiveClub club={club} />
            </HStack>
          }
        />
      ))}
    </List>
  );
}
