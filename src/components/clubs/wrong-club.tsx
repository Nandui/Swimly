import { Building2 } from "lucide-react";
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
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed px-6 py-14 text-center">
      <Building2 className="mb-3 size-6 text-muted-foreground/60" strokeWidth={1.5} />
      <p className="text-sm font-medium text-foreground">
        {what} belongs to {owner.name}
      </p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        You are working in {current.name}. Nothing from one club can be changed while working in
        another; switch, and this page comes back as it is there.
      </p>
      <div className="mt-4">
        <SwitchClubButton club={owner} />
      </div>
    </div>
  );
}
