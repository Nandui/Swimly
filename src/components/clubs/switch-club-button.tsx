"use client";
import { Button } from "@/components/shadcn/button";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight } from "lucide-react";

import { switchClub } from "@/lib/clubs/actions/clubs";
import { toast } from "@/lib/toast";

/** The way through from a page that belongs to another club: switch, and
 *  stay on the page, which then renders as it does there. */
export function SwitchClubButton({
  club,
}: {
  club: { id: string; name: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      onClick={() =>
        startTransition(async () => {
          const result = await switchClub(club.id, { stay: true });
          if (result.ok) router.refresh();
          else toast.error(result.error);
        })
      }
      variant="default"
      disabled={pending}
      aria-busy={pending}
    >
      {<ArrowLeftRight aria-hidden={true} className="size-4 shrink-0" />}
      {pending ? "Switching…" : `Switch to ${club.name}`}
    </Button>
  );
}
