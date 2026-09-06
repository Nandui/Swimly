"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@astryxdesign/core/Button";
import { switchClub } from "@/lib/clubs/actions/clubs";
import { toast } from "@/lib/toast";

/** The way through from a page that belongs to another club: switch, and
 *  stay on the page, which then renders as it does there. */
export function SwitchClubButton({ club }: { club: { id: string; name: string } }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      label={pending ? "Switching…" : `Switch to ${club.name}`}
      variant="primary"
      isLoading={pending}
      icon={<ArrowLeftRight className="size-4" aria-hidden />}
      onClick={() =>
        startTransition(async () => {
          const result = await switchClub(club.id, { stay: true });
          if (result.ok) router.refresh();
          else toast.error(result.error);
        })
      }
    />
  );
}
