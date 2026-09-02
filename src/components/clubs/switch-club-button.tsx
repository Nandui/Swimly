"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { switchClub } from "@/lib/clubs/actions/clubs";

/** The way through from a page that belongs to another club: switch, and
 *  stay on the page, which then renders as it does there. */
export function SwitchClubButton({ club }: { club: { id: string; name: string } }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      type="button"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await switchClub(club.id, { stay: true });
          if (result.ok) router.refresh();
          else toast.error(result.error);
        })
      }
    >
      <ArrowLeftRight className="size-4" />
      {pending ? "Switching…" : `Switch to ${club.name}`}
    </Button>
  );
}
