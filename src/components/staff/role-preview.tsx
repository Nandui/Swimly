"use client";

import * as React from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import { Banner } from "@/components/workspace/feedback";
import { DropdownMenu } from "@/components/workspace/overlays";
import { previewRole } from "@/lib/staff/actions/preview";
import { toast } from "@/lib/toast";
import { Icon } from "@/components/workspace/misc";

type RoleOption = { id: string; name: string; description: string | null };

/** The dev build's "view as" bar. A full-width warning banner, always
 *  visible while it applies, so nobody forgets they are looking through
 *  somebody else's eyes. The list is every role in the database, read fresh
 *  on each page, so a role made a minute ago is in it. */
export function RolePreviewBar({
  roles,
  current,
  actualRoleName,
}: {
  roles: RoleOption[];
  /** The role being previewed, or null when seeing the app as yourself. */
  current: { id: string; name: string } | null;
  actualRoleName: string;
}) {
  const [pending, startTransition] = React.useTransition();

  function choose(id: string | null) {
    if ((current?.id ?? null) === id) return;
    startTransition(async () => {
      const result = await previewRole(id);
      // A successful switch redirects, so only a refusal ever comes back.
      if (result && !result.ok) toast.error(result.error);
    });
  }

  const roleItems = roles.map((role) => ({
    id: role.id,
    label: role.name,
    description: role.description ?? undefined,
    onClick: () => choose(role.id),
    endContent:
      role.id === current?.id ? <Icon icon={Check} size="sm" label="Current" /> : undefined,
  }));

  return (
    <Banner
      status="warning"
      container="section"
      collapsible={false}
      title="Dev build"
      description={
        current
          ? `Seeing the app as ${current.name}. You are ${actualRoleName}.`
          : `You are ${actualRoleName}. Pick a role to see the app as they would.`
      }
      endContent={
        <DropdownMenu
          alignment="end"
          menuWidth={288}
          button={{
            label: current ? `Viewing as ${current.name}. Change role` : "View as a role",
            children: pending ? "Switching…" : (current?.name ?? "View as"),
            icon: <Icon icon={Eye} size="sm" />,
            variant: "secondary",
            size: "sm",
            isDisabled: pending,
          }}
          items={[
            { type: "section", title: "See the app as", items: roleItems },
            ...(current
              ? [
                  { type: "divider" as const },
                  {
                    id: "stop",
                    label: `Stop, back to being ${actualRoleName}`,
                    icon: EyeOff,
                    onClick: () => choose(null),
                  },
                ]
              : []),
          ]}
        />
      }
    />
  );
}
