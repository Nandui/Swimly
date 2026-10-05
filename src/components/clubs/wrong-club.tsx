import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";

import { SwitchClubButton } from "@/components/clubs/switch-club-button";

type Club = { id: string; name: string };

/** What a detail page shows when the thing it was asked for belongs to a
 *  site other than the one being worked at: a link followed from a message,
 *  a bookmark from last week.
 *
 *  Showing the page anyway would be the quiet mistake the switcher exists to
 *  prevent: every list and picker around it would be the current site's, and
 *  an enrolment made from it would cross sites. So the page says whose it is
 *  and offers the switch, and nothing else. A page with its own header (the
 *  pool deck's class) passes `header={false}` and keeps it. */
export function WrongClub({
  what,
  owner,
  current,
  noun = "it",
  header = true,
}: {
  what: string;
  owner: Club;
  current: Club;
  /** What the hint says the switch lets you work on ("this class"). */
  noun?: string;
  header?: boolean;
}) {
  const state = (
    <EmptyState
      icon="building"
      as={header ? undefined : "h2"}
      title={`${what} belongs to ${owner.name}`}
      hint={`You are working at ${current.name}. Switch to ${owner.name} to work on ${noun}.`}
      action={<SwitchClubButton club={owner} />}
    />
  );
  if (!header) return state;
  return (
    <div className="min-w-0 flex flex-col gap-6">
      <PageHeader title="Switch site to continue" />
      {state}
    </div>
  );
}
