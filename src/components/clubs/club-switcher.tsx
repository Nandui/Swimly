"use client";

import * as React from "react";
import { Building2, Check } from "lucide-react";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { switchClub } from "@/lib/clubs/actions/clubs";
import { toast } from "@/lib/toast";

type Club = { id: string; name: string };

/** Always named, including in the mobile bar and collapsed-rail toolbar.
 *  Switching returns through /start to the person's permitted home screen. */
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
        children: (
          <Text type="inherit" maxLines={1} hasTruncateTooltip={false}>
            {pending ? "Switching…" : club.name}
          </Text>
        ),
        icon: <Icon icon={Building2} size="sm" />,
        variant: "secondary",
        size: "md",
        width: "100%",
        className: "justify-start min-w-0",
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
