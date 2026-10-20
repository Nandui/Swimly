"use client";

import Link from "next/link";
import { CircleUserRound } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { useSession } from "@/lib/use-session";

/** "My bookings" once signed in on this browser, otherwise "Sign in". */
export function AccountLink() {
  const who = useSession();
  if (who === undefined) return <span className="topnav-link" aria-hidden="true" />;
  return (
    <Button asChild variant="outline">
      {who ? <Link href="/bookings"><CircleUserRound aria-hidden="true" />My bookings</Link> : <Link href="/sign-in">Sign in</Link>}
    </Button>
  );
}
