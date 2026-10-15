"use client";

import Link from "next/link";
import { CircleUserRound } from "lucide-react";
import { useSession } from "@/lib/use-session";

/** "My bookings" once signed in on this browser, otherwise "Sign in". */
export function AccountLink() {
  const who = useSession();
  if (who === undefined) return <span className="topnav-link" aria-hidden="true" />;
  return who
    ? <Link href="/bookings" className="button outline"><CircleUserRound aria-hidden="true" />My bookings</Link>
    : <Link href="/sign-in" className="button outline">Sign in</Link>;
}
