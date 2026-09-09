"use client";

import * as React from "react";
import { Building2, Check } from "lucide-react";
import { DropdownMenu } from "@/components/workspace/overlays";
import { Icon } from "@/components/workspace/misc";
import { Text } from "@/components/workspace/typography";
import { switchClub } from "@/lib/clubs/actions/clubs";
import { toast } from "@/lib/toast";

type Club = { id: string; name: string };

/** Which club the app is showing, and the way to change it.
 *
 *  It is in the TopNav the whole time, because the mistake it exists to
 *  prevent is a quiet one: enrolling a child into the other site's class, or
 *  adding a class to the wrong timetable, and not finding out until the
 *  family turns up at the wrong pool. The club's name is the heading's
 *  subheading, so it reads on every device; this is the control that changes
 *  it. Below the tablet breakpoint the button drops its text and keeps its
 *  icon, chevron and accessible name, so the phone bar still fits the drawer
 *  toggle. Switching lands on the overview rather than leaving somebody on a
 *  page that belonged to the old club. */
export function ClubSwitcher({ club, clubs }: { club: Club; clubs: Club[] }) {
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
      hasChevron={several}
      placement="below"
      alignment="start"
      menuWidth={256}
      button={{
        // The accessible name says what the control is; the visible text is
        // the club, which is the thing that must always be readable.
        label: `Club: ${club.name}. ${several ? "Switch club" : "The only club"}`,
        // Responsive contract (see app-shell): text from md up, icon only
        // below. The bridge's breakpoint is the same "md" the shell's drawer
        // uses, so both change together.
        children: (
          <Text type="inherit" maxLines={1} hasTruncateTooltip={false} className="truncate">
            {pending ? "Switching…" : club.name}
          </Text>
        ),
        icon: <Icon icon={Building2} size="sm" />,
        variant: "secondary",
        size: "md",
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
                <Icon icon={Check} size="sm" label="Current" />
              ) : undefined,
          })),
        },
      ]}
    />
  );
}
