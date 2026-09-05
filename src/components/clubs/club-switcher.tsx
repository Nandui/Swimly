"use client";

import * as React from "react";
import { Building2, Check } from "lucide-react";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { switchClub } from "@/lib/clubs/actions/clubs";
import { toast } from "@/lib/toast";

type Club = { id: string; name: string };

/** Which club the app is showing, and the way to change it.
 *
 *  It is on screen the whole time — above the nav on desktop, in the bar on a
 *  phone — because the mistake it exists to prevent is a quiet one: enrolling
 *  a child into the other site's class, or adding a class to the wrong
 *  timetable, and not finding out until the family turns up at the wrong
 *  pool. So the name is always readable, and switching lands on the overview
 *  rather than leaving somebody on a page that belonged to the old club. */
export function ClubSwitcher({
  club,
  clubs,
  collapsed = false,
  compact = false,
}: {
  club: Club;
  clubs: Club[];
  collapsed?: boolean;
  compact?: boolean;
}) {
  const [pending, startTransition] = React.useTransition();
  const several = clubs.length > 1;

  function choose(id: string) {
    if (id === club.id) return;
    startTransition(async () => {
      const result = await switchClub(id);
      // A successful switch redirects, so only a refusal ever comes back.
      if (result && !result.ok) toast.error(result.error);
    });
  }

  return (
    <DropdownMenu
      hasChevron={several && !collapsed}
      placement="below"
      alignment="start"
      menuWidth={256}
      button={{
        // The accessible name says what the control is; the visible text is
        // the club, which is the thing that must always be readable.
        label: `Club: ${club.name}. ${several ? "Switch club" : "The only club"}`,
        // A long club name in the phone bar must not push the drawer toggle
        // off the screen, so the visible text is cut with an ellipsis there;
        // the full name is in the accessible label and the menu.
        children: (
          <span className={compact ? "block max-w-[40vw] truncate" : undefined}>
            {pending ? "Switching…" : club.name}
          </span>
        ),
        icon: <Building2 className="size-4" aria-hidden />,
        isIconOnly: collapsed,
        tooltip: collapsed ? club.name : undefined,
        variant: "secondary",
        size: compact ? "sm" : "md",
        width: collapsed || compact ? undefined : "100%",
        isDisabled: pending,
      }}
      items={[
        {
          type: "section",
          title: several ? "Switch club" : "The only club",
          items: clubs.map((option) => ({
            id: option.id,
            label: option.name,
            onClick: () => choose(option.id),
            endContent:
              option.id === club.id ? (
                <Check className="size-4" aria-label="Current" />
              ) : undefined,
          })),
        },
      ]}
    />
  );
}
