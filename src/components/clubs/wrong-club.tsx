import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { VStack } from "@/components/workspace/layout";
import { SwitchClubButton } from "@/components/clubs/switch-club-button";

type Club = { id: string; name: string };

/** What a detail page shows when the thing it was asked for belongs to a
 *  club other than the one being worked in — a link followed from a message,
 *  a bookmark from last week.
 *
 *  Showing the page anyway would be the quiet mistake the switcher exists to
 *  prevent: every list and picker around it would be the current club's, and
 *  an enrolment made from it would cross sites. So the page says whose it is
 *  and offers the switch, and nothing else. */
export function WrongClub({ what, owner, current }: { what: string; owner: Club; current: Club }) {
  return (
    <VStack gap={6}>
      <PageHeader title="Switch club to continue" />
      <EmptyState
        icon="building"
        title={`${what} belongs to ${owner.name}`}
        hint={`You are working in ${current.name}. Nothing from one club can be changed while working in another; switch, and this page comes back as it is there.`}
        action={<SwitchClubButton club={owner} />}
      />
    </VStack>
  );
}
